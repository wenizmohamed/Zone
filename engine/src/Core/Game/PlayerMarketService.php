<?php
declare(strict_types=1);
namespace Zone\Engine\Core\Game;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Economy\Ledger;

/** Actual owned units are escrowed; purchases transfer conserved cash and units atomically. */
final readonly class PlayerMarketService
{
    public function __construct(private Database $database, private EventBus $events) {}

    public function snapshot(string $playerId): array
    {
        $inventory = (new ProgressionService($this->database,$this->events))->snapshot($playerId);
        $rows = $this->database->fetchAll("SELECT l.*,p.username FROM player_market_listings l JOIN players p ON p.id=l.seller_id WHERE l.state='active' AND l.quantity>0 ORDER BY l.created_at DESC,l.id DESC LIMIT 200");
        $listings = array_map(static fn($r)=>['id'=>$r['id'],'sellerId'=>$r['seller_id'],'sellerName'=>$r['username'],'itemId'=>$r['item_id'],'itemName'=>json_decode($r['item_json'],true,512,JSON_THROW_ON_ERROR)['name'] ?? $r['item_id'],'quantity'=>(int)$r['quantity'],'unitPrice'=>(int)$r['unit_price'],'totalPrice'=>(int)$r['quantity']*(int)$r['unit_price'],'version'=>(int)$r['version'],'own'=>$r['seller_id']===$playerId],$rows);
        $ownRows = $this->database->fetchAll("SELECT l.*,p.username FROM player_market_listings l JOIN players p ON p.id=l.seller_id WHERE l.seller_id=:id AND l.state='active' ORDER BY l.created_at DESC,l.id DESC",['id'=>$playerId]);
        $own = array_map(static fn($r)=>['id'=>$r['id'],'sellerId'=>$r['seller_id'],'sellerName'=>$r['username'],'itemId'=>$r['item_id'],'itemName'=>json_decode($r['item_json'],true,512,JSON_THROW_ON_ERROR)['name'] ?? $r['item_id'],'quantity'=>(int)$r['quantity'],'unitPrice'=>(int)$r['unit_price'],'totalPrice'=>(int)$r['quantity']*(int)$r['unit_price'],'version'=>(int)$r['version'],'own'=>true],$ownRows);
        return ['listings'=>$listings,'ownListings'=>$own,'inventoryVersion'=>$inventory['state']['version']];
    }

    public function act(string $action,string $id,int $quantity,int $unitPrice,int $expectedVersion,string $playerId): array
    {
        if (!in_array($action,['list','buy','cancel'],true) || $expectedVersion<1 || $quantity<1 || $quantity>1000) throw new InvalidArgumentException('Invalid market action, quantity or version.');
        if ($action==='list' && ($unitPrice<1 || $unitPrice>1000000)) throw new InvalidArgumentException('Unit price must be between 1 and 1,000,000.');
        $sellerId = $playerId;
        if ($action!=='list') {
            $hint = $this->database->fetchOne('SELECT seller_id FROM player_market_listings WHERE id=:id',['id'=>$id]);
            if ($hint===null) throw new InvalidArgumentException('Unknown player listing.');
            $sellerId = (string)$hint['seller_id'];
        }
        return $this->database->playersTransaction([$playerId,$sellerId],function()use($action,$id,$quantity,$unitPrice,$expectedVersion,$playerId,$sellerId):array {
            $progress = new ProgressionService($this->database,$this->events);
            $progress->assertAvailable($playerId);
            (new TravelService($this->database,$this->events))->assertAvailable($playerId);
            $correlation = bin2hex(random_bytes(16));
            if ($action==='list') {
                $snapshot = $progress->snapshot($playerId);
                $item = $snapshot['catalogs']['items'][$id] ?? null;
                if ($item===null || $id==='fists' || !empty($item['unavailable'])) throw new InvalidArgumentException('This item cannot be listed.');
                $active = (int)$this->database->fetchOne("SELECT COUNT(*) AS total FROM player_market_listings WHERE seller_id=:id AND state='active'",['id'=>$playerId])['total'];
                if ($active>=50) throw new RuntimeException('Cancel or sell an existing listing before creating another.');
                $progress->escrowInventory($playerId,$id,-$quantity,'player-market.list',$correlation,$expectedVersion);
                $listingId = bin2hex(random_bytes(16)); $now=gmdate('c');
                $this->database->execute("INSERT INTO player_market_listings(id,seller_id,item_id,item_json,quantity,unit_price,state,version,created_at,updated_at) VALUES(:id,:seller,:item,:json,:quantity,:price,'active',1,:created,:updated)",['id'=>$listingId,'seller'=>$playerId,'item'=>$id,'json'=>json_encode($item,JSON_THROW_ON_ERROR),'quantity'=>$quantity,'price'=>$unitPrice,'created'=>$now,'updated'=>$now]);
                $result=['action'=>$action,'listingId'=>$listingId,'itemId'=>$id,'quantity'=>$quantity,'cashDelta'=>0,'correlationId'=>$correlation];
            } else {
                $listing=$this->database->fetchOne('SELECT * FROM player_market_listings WHERE id=:id' . ($this->database->driver()==='pgsql'?' FOR UPDATE':''),['id'=>$id]);
                if ($listing===null || $listing['seller_id']!==$sellerId) throw new RuntimeException('Listing changed. Refresh and try again.');
                if ((int)$listing['version']!==$expectedVersion) throw new RuntimeException('Listing state changed. Refresh and try again.');
                if ($listing['state']!=='active' || (int)$listing['quantity']<1) throw new RuntimeException('This listing is no longer available.');
                $itemId=(string)$listing['item_id'];
                if ($action==='cancel') {
                    if ($sellerId!==$playerId) throw new RuntimeException('Only the seller can cancel this listing.');
                    $quantity=(int)$listing['quantity'];
                    $progress->escrowInventory($playerId,$itemId,$quantity,'player-market.cancel',$correlation);
                    $this->database->execute("UPDATE player_market_listings SET quantity=0,state='cancelled',version=version+1,updated_at=:at WHERE id=:id",['id'=>$id,'at'=>gmdate('c')]);
                    $result=['action'=>$action,'listingId'=>$id,'itemId'=>$itemId,'quantity'=>$quantity,'cashDelta'=>0,'correlationId'=>$correlation];
                } else {
                    if ($playerId===$sellerId) throw new RuntimeException('You cannot buy your own listing.');
                    if ($quantity>(int)$listing['quantity']) throw new RuntimeException('Not enough stock remains.');
                    $buyerSnapshot=$progress->snapshot($playerId);
                    if (!isset($buyerSnapshot['catalogs']['items'][$itemId])) throw new RuntimeException('This item is unavailable in the current release.');
                    $total=$quantity*(int)$listing['unit_price'];
                    $buyer=$this->database->fetchOne('SELECT cash FROM players WHERE id=:id',['id'=>$playerId]);
                    $seller=$this->database->fetchOne('SELECT cash FROM players WHERE id=:id',['id'=>$sellerId]);
                    if ((int)$buyer['cash']<$total) throw new RuntimeException('Not enough cash for this purchase.');
                    $this->database->execute('UPDATE players SET cash=cash-:amount WHERE id=:id',['id'=>$playerId,'amount'=>$total]);
                    $this->database->execute('UPDATE players SET cash=cash+:amount WHERE id=:id',['id'=>$sellerId,'amount'=>$total]);
                    $ledger=new Ledger($this->database);
                    $ledger->record($playerId,'cash',-$total,(int)$buyer['cash']-$total,'player-market.buy',$correlation);
                    $ledger->record($sellerId,'cash',$total,(int)$seller['cash']+$total,'player-market.buy',$correlation);
                    $progress->escrowInventory($playerId,$itemId,$quantity,'player-market.buy',$correlation);
                    $progress->recordMetric($playerId,'buys',1);
                    $remaining=(int)$listing['quantity']-$quantity;
                    $this->database->execute('UPDATE player_market_listings SET quantity=:quantity,state=:state,version=version+1,updated_at=:at WHERE id=:id',['id'=>$id,'quantity'=>$remaining,'state'=>$remaining===0?'sold':'active','at'=>gmdate('c')]);
                    $result=['action'=>$action,'listingId'=>$id,'itemId'=>$itemId,'quantity'=>$quantity,'cashDelta'=>-$total,'sellerCashDelta'=>$total,'correlationId'=>$correlation];
                }
            }
            $this->events->publish(new DomainEvent('PlayerMarketSettled',['playerId'=>$playerId,'sellerId'=>$sellerId,...$result]));
            return [...$this->snapshot($playerId),'result'=>$result];
        });
    }

    public function activeListingCount(?string $sellerId = null): int
    {
        $row = $sellerId === null
            ? $this->database->fetchOne("SELECT COUNT(*) AS total FROM player_market_listings WHERE state='active' AND quantity>0")
            : $this->database->fetchOne("SELECT COUNT(*) AS total FROM player_market_listings WHERE seller_id=:seller AND state='active' AND quantity>0", ['seller' => $sellerId]);
        return (int) ($row['total'] ?? 0);
    }
}
