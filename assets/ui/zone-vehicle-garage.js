/* ==========================================================================
 * ZONE v157 - TRACK 8: SYNDICATE 3D VEHICLE GARAGE & A* SMUGGLING PLANNER
 * Exclusive Ownership: @vehicle-3d-sim (assets/ui/zone-vehicle-garage.js)
 * Exposes: window.ZoneVehicleGarage & globalThis.__ZoneVehicleGarage157
 * Mounts ONLY on screen === 'city' (and travel panels); 0 mounts on home!
 * Fiber-Safe: Append/adjacent mount outside <x-dc>; zero Home clutter.
 * ========================================================================== */
(function (root) {
  'use strict';

  if (root && root.__zoneVehicleGarageBooted && root.ZoneVehicleGarage) {
    return;
  }
  if (root) {
    root.__zoneVehicleGarageBooted = true;
  }

  /* ---------------- Syndicate Vehicle Fleet Catalog ---------------- */
  var VEHICLES = [
    {
      id: 'nightshade_gt',
      en: 'Nightshade GT',
      ar: 'نايت شيد جي تي',
      classEn: 'Twin-Turbo Coupe',
      classAr: 'كوبيه تيربو مزدوج',
      item3d: 'sports_car',
      cat3d: 'vehicle',
      massKg: 1320,
      basePowerHp: 640,
      aeroCd: 0.29,
      frontalAreaM2: 2.08,
      wheelbaseM: 2.68,
      cgHeightM: 0.44,
      driveType: 'RWD',
      armorRating: 38,
      baseNoiseDb: 64,
      alleyAgility: 0.94,
      defaults: { suspensionStiffness: 62, gearRatio: 3.45, tireGrip: 76, nitroBoost: 50 }
    },
    {
      id: 'pier4_armored_van',
      en: 'Pier 4 Armored Van',
      ar: 'فان الميناء ٤ المدرعة',
      classEn: 'Heavy Cargo Hauler',
      classAr: 'ناقلة بضائع مدرعة',
      item3d: 'sports_car',
      cat3d: 'vehicle',
      massKg: 3150,
      basePowerHp: 510,
      aeroCd: 0.48,
      frontalAreaM2: 3.65,
      wheelbaseM: 3.42,
      cgHeightM: 0.78,
      driveType: 'AWD',
      armorRating: 94,
      baseNoiseDb: 72,
      alleyAgility: 0.58,
      defaults: { suspensionStiffness: 74, gearRatio: 4.10, tireGrip: 68, nitroBoost: 30 }
    },
    {
      id: 'apex_interceptor',
      en: 'Apex Interceptor',
      ar: 'أبيكس الاعتراضية',
      classEn: 'AWD Pursuit Sedan',
      classAr: 'سيدان مطاردة دفع كلي',
      item3d: 'sports_car',
      cat3d: 'vehicle',
      massKg: 1540,
      basePowerHp: 760,
      aeroCd: 0.27,
      frontalAreaM2: 2.15,
      wheelbaseM: 2.76,
      cgHeightM: 0.42,
      driveType: 'AWD',
      armorRating: 62,
      baseNoiseDb: 76,
      alleyAgility: 0.88,
      defaults: { suspensionStiffness: 70, gearRatio: 3.65, tireGrip: 84, nitroBoost: 65 }
    },
    {
      id: 'stealth_enduro_bike',
      en: 'Stealth Enduro Bike',
      ar: 'دراجة إندورو الشبحية',
      classEn: 'Silent Alley Runner',
      classAr: 'دراجة تسلل صامتة',
      item3d: 'mountain_bike',
      cat3d: 'vehicle',
      massKg: 148,
      basePowerHp: 112,
      aeroCd: 0.56,
      frontalAreaM2: 0.78,
      wheelbaseM: 1.44,
      cgHeightM: 0.62,
      driveType: 'RWD',
      armorRating: 18,
      baseNoiseDb: 28,
      alleyAgility: 1.32,
      defaults: { suspensionStiffness: 48, gearRatio: 3.80, tireGrip: 78, nitroBoost: 35 }
    }
  ];

  var VEHICLE_MAP = {};
  for (var vi = 0; vi < VEHICLES.length; vi++) {
    VEHICLE_MAP[VEHICLES[vi].id] = VEHICLES[vi];
  }

  var TUNING_PRESETS = {
    street: {
      id: 'street',
      en: 'Street Spec',
      ar: 'تجهيز الشارع',
      tuning: { suspensionStiffness: 58, gearRatio: 3.55, tireGrip: 76, nitroBoost: 45 }
    },
    track: {
      id: 'track',
      en: 'Track Drift',
      ar: 'انجراف الحلبة',
      tuning: { suspensionStiffness: 84, gearRatio: 3.05, tireGrip: 92, nitroBoost: 85 }
    },
    ghost: {
      id: 'ghost',
      en: 'Ghost Smuggler',
      ar: 'تخفّي التهريب',
      tuning: { suspensionStiffness: 46, gearRatio: 3.90, tireGrip: 82, nitroBoost: 15 }
    }
  };

  /* ---------------- 6-District Zone City Smuggling Graph (A*) ---------------- */
  var DISTRICTS = [
    { id: 'pier_4', en: 'Pier 4 Docks', ar: 'أرصفة الميناء ٤', x: 14, y: 78, checkpoints: 2, roughness: 0.65 },
    { id: 'industrial_foundry', en: 'Industrial Foundry', ar: 'المسبك الصناعي', x: 38, y: 84, checkpoints: 1, roughness: 0.55 },
    { id: 'neon_alley', en: 'Neon Alley', ar: 'زقاق النيون', x: 34, y: 46, checkpoints: 3, roughness: 0.30 },
    { id: 'midtown_exchange', en: 'Midtown Exchange', ar: 'سوق وسط المدينة', x: 60, y: 52, checkpoints: 4, roughness: 0.20 },
    { id: 'downtown_vaults', en: 'Downtown Vaults', ar: 'خزائن وسط المدينة', x: 86, y: 66, checkpoints: 5, roughness: 0.15 },
    { id: 'north_airstrip', en: 'North Airstrip', ar: 'المدرج الشمالي', x: 82, y: 18, checkpoints: 2, roughness: 0.25 }
  ];

  var DISTRICT_MAP = {};
  for (var di = 0; di < DISTRICTS.length; di++) {
    DISTRICT_MAP[DISTRICTS[di].id] = DISTRICTS[di];
  }

  var CORRIDOR_EDGES = [
    { from: 'pier_4', to: 'industrial_foundry', distanceKm: 2.4, speedLimitKmh: 68, alleyWidth: 'standard', patrolIntensity: 0.14, roughness: 0.58 },
    { from: 'pier_4', to: 'neon_alley', distanceKm: 3.1, speedLimitKmh: 54, alleyWidth: 'tight', patrolIntensity: 0.24, roughness: 0.44 },
    { from: 'industrial_foundry', to: 'neon_alley', distanceKm: 2.9, speedLimitKmh: 62, alleyWidth: 'tight', patrolIntensity: 0.18, roughness: 0.48 },
    { from: 'industrial_foundry', to: 'downtown_vaults', distanceKm: 4.5, speedLimitKmh: 92, alleyWidth: 'highway', patrolIntensity: 0.52, roughness: 0.22 },
    { from: 'neon_alley', to: 'midtown_exchange', distanceKm: 2.2, speedLimitKmh: 58, alleyWidth: 'tight', patrolIntensity: 0.38, roughness: 0.28 },
    { from: 'neon_alley', to: 'north_airstrip', distanceKm: 5.0, speedLimitKmh: 76, alleyWidth: 'standard', patrolIntensity: 0.16, roughness: 0.42 },
    { from: 'midtown_exchange', to: 'downtown_vaults', distanceKm: 2.5, speedLimitKmh: 84, alleyWidth: 'highway', patrolIntensity: 0.66, roughness: 0.16 },
    { from: 'midtown_exchange', to: 'north_airstrip', distanceKm: 3.4, speedLimitKmh: 108, alleyWidth: 'highway', patrolIntensity: 0.48, roughness: 0.18 },
    { from: 'downtown_vaults', to: 'north_airstrip', distanceKm: 3.9, speedLimitKmh: 118, alleyWidth: 'highway', patrolIntensity: 0.62, roughness: 0.16 },
    { from: 'pier_4', to: 'midtown_exchange', distanceKm: 4.6, speedLimitKmh: 96, alleyWidth: 'highway', patrolIntensity: 0.56, roughness: 0.24 }
  ];

  var I18N = {
    en: {
      title: 'Syndicate 3D Vehicle Garage & Smuggling Corridor',
      subtitle: 'Suspension/drivetrain physics tuning paired with A* checkpoint corridor planning.',
      badgeMode: 'City & Travel Ops',
      fleetTitle: '1. Syndicate Fleet & 3D Preview',
      tuningTitle: '2. Physics & Suspension Workbench',
      inspect3d: '3D Inspect',
      pulse3d: 'Test Spring & Nitro',
      springTelemetry: 'Damped Spring Pitch/Roll',
      lblSuspension: 'Suspension Stiffness',
      lblGearRatio: 'Final Gear Ratio',
      lblTireGrip: 'Tire Compound Grip',
      lblNitro: 'Nitro Boost Mix',
      kpiTransfer: 'Weight Transfer / Roll',
      kpiTraction: 'Traction & Lateral G',
      kpiSpeed: 'Top Speed / 0-100',
      kpiEvasion: 'Evasion / Heat Sig',
      plannerTitle: '3. A* District Smuggling Corridor',
      originLbl: 'Origin District',
      destLbl: 'Target Drop',
      alertLbl: 'Police Alert Level',
      modeLowHeat: 'Low-Heat Stealth',
      modeFastest: 'Fastest Sprint',
      etaLbl: 'Route ETA',
      riskLbl: 'Checkpoint Risk',
      nodesLbl: 'A* Expanded',
      comparePrefix: 'Alternate',
      runSmuggleBtn: 'Simulate Smuggling Run',
      clickHint: 'Tap any map node to set Origin / Drop',
      runSuccess: 'Corridor cleared cleanly!',
      runIntercept: 'Checkpoint spotlight grazed your plate!',
      pulseMsg: '3D Stage & suspension rig pulsed.'
    },
    ar: {
      title: 'كراج المركبات ثلاثي الأبعاد ومخطط مسارات التهريب A*',
      subtitle: 'ضبط فيزياء التعليق ونقل الحركة مع تخطيط مسارات التهريب وتفادي نقاط التفتيش.',
      badgeMode: 'عمليات المدينة والسفر',
      fleetTitle: '١. أسطول النقابة والمعاينة ثلاثية الأبعاد',
      tuningTitle: '٢. طاولة ضبط الفيزياء والتعليق',
      inspect3d: 'فحص ٣D',
      pulse3d: 'اختبار التعليق والنيترو',
      springTelemetry: 'اهتزاز النابض والميلان',
      lblSuspension: 'صلابة نظام التعليق',
      lblGearRatio: 'نسبة الترس النهائي',
      lblTireGrip: 'تماسك الإطارات',
      lblNitro: 'خليط دفعة النيترو',
      kpiTransfer: 'انتقال الوزن / الميلان',
      kpiTraction: 'التماسك والقوة الجانبية',
      kpiSpeed: 'السرعة القصوى / ٠-١٠٠',
      kpiEvasion: 'المراوغة / البصمة الحرارية',
      plannerTitle: '٣. مخطط مسار التهريب A* بين الأحياء',
      originLbl: 'حي الانطلاق',
      destLbl: 'نقطة التسليم',
      alertLbl: 'حالة استنفار الشرطة',
      modeLowHeat: 'أقل حرارة وتخفّي',
      modeFastest: 'الأسرع زمنياً',
      etaLbl: 'زمن الوصول',
      riskLbl: 'خطر التفتيش',
      nodesLbl: 'عقد A*',
      comparePrefix: 'المسار البديل',
      runSmuggleBtn: 'محاكاة جولة التهريب',
      clickHint: 'اضغط على أي حي بالخريطة لتحديد الانطلاق أو الهدف',
      runSuccess: 'تم عبور المسار بنجاح ونظافة تامة!',
      runIntercept: 'كشّاف التفتيش رصد لوحتك أثناء العبور!',
      pulseMsg: 'تم تنشيط منصة ٣D واختبار نوابض التعليق.'
    }
  };

  /* ---------------- Shared Numeric & Frame-Rate-Independent Helpers ---------------- */
  function clamp(v, min, max) {
    var n = Number(v);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function roundTo(v, decimals) {
    var factor = Math.pow(10, decimals || 0);
    return Math.round(v * factor) / factor;
  }

  function expSmooth(current, target, rate, dt) {
    var c = Number(current) || 0;
    var t = Number(target) || 0;
    var r = Math.max(0.01, Number(rate) || 8);
    var d = Math.max(0, Number(dt) || 0);
    var alpha = 1 - Math.exp(-r * d);
    return c + (t - c) * alpha;
  }

  function stepSuspensionSpring(state, impulse, stiffnessNorm, dt, reducedMotion) {
    var s = state || { displacement: 0, velocity: 0 };
    if (reducedMotion) {
      s.displacement = 0;
      s.velocity = 0;
      return s;
    }
    var safeDt = Math.min(0.05, Math.max(0.001, Number(dt) || 0.016));
    var subSteps = Math.max(1, Math.ceil(safeDt / 0.008));
    var h = safeDt / subSteps;
    var omega = 10 + clamp(stiffnessNorm, 0.1, 1.0) * 14;
    var zeta = 0.38 + clamp(stiffnessNorm, 0.1, 1.0) * 0.34;
    s.velocity += Number(impulse || 0);
    for (var i = 0; i < subSteps; i++) {
      var accel = -omega * omega * s.displacement - 2 * zeta * omega * s.velocity;
      s.velocity += accel * h;
      s.displacement += s.velocity * h;
    }
    if (Math.abs(s.displacement) < 0.0005 && Math.abs(s.velocity) < 0.002) {
      s.displacement = 0;
      s.velocity = 0;
    }
    return s;
  }

  /* ---------------- Vehicle Physics & Tuning Workbench ---------------- */
  function normalizeTuning(raw) {
    var t = raw || {};
    return {
      suspensionStiffness: clamp(t.suspensionStiffness != null ? t.suspensionStiffness : 58, 15, 100),
      gearRatio: roundTo(clamp(t.gearRatio != null ? t.gearRatio : 3.55, 2.40, 4.90), 2),
      tireGrip: clamp(t.tireGrip != null ? t.tireGrip : 76, 30, 100),
      nitroBoost: clamp(t.nitroBoost != null ? t.nitroBoost : 45, 0, 100)
    };
  }

  function computeVehiclePhysics(vehicleId, rawTuning) {
    var v = VEHICLE_MAP[vehicleId] || VEHICLES[0];
    var t = normalizeTuning(rawTuning || v.defaults);

    var stiffNorm = t.suspensionStiffness / 100;
    var gripNorm = t.tireGrip / 100;
    var nitroNorm = t.nitroBoost / 100;
    var gearNorm = (t.gearRatio - 2.40) / (4.90 - 2.40); /* 0 = tall overdrive, 1 = short torque */

    /* Aerodynamic drag-limited power & overdrive speed */
    var effPowerHp = v.basePowerHp * (1 + nitroNorm * 0.42);
    var powerWatts = effPowerHp * 745.7;
    var airRho = 1.225;
    var dragFactor = 0.5 * airRho * v.aeroCd * v.frontalAreaM2;
    var vAeroMs = Math.cbrt(powerWatts / Math.max(0.1, dragFactor));
    /* Shorter final drive caps redline top speed while giving punchy launch */
    var gearTopSpeedMult = 1.07 - gearNorm * 0.22;
    var topSpeedKmh = roundTo(clamp(vAeroMs * 3.6 * gearTopSpeedMult * 0.88, 115, 395), 1);

    /* Tire friction & suspension contact-patch compliance */
    var mu = 0.72 + gripNorm * 0.68;
    var driveTractionBonus = v.driveType === 'AWD' ? 1.12 : 1.0;
    var compliancePenalty = t.suspensionStiffness > 86 ? (t.suspensionStiffness - 86) * 0.006 : 0;
    var effMu = mu * driveTractionBonus * (1 - compliancePenalty);

    var lateralG = roundTo(clamp(effMu * (1.06 - (v.cgHeightM - 0.40) * 0.35), 0.68, 1.58), 2);
    var tractionScore = Math.round(clamp(effMu * 64 - nitroNorm * 6 + (v.driveType === 'AWD' ? 8 : 0), 25, 99));

    /* Longitudinal acceleration & weight transfer */
    var powerToWeight = effPowerHp / (v.massKg / 1000);
    var torqueMult = 0.82 + gearNorm * 0.44;
    var maxAccelG = clamp((powerToWeight * torqueMult) / 360, 0.28, effMu * 1.02);
    var zeroToHundredSec = roundTo(clamp(27.78 / (maxAccelG * 9.81) + 0.32, 2.05, 11.4), 2);

    /* Weight transfer (percentage of static axle load shifted under launch/cornering) */
    var weightTransferPct = roundTo(
      clamp((maxAccelG * (v.cgHeightM / v.wheelbaseM) * (1.12 - stiffNorm * 0.34)) * 100, 7.5, 48.0),
      1
    );
    var bodyRollDeg = roundTo(
      clamp((lateralG * v.cgHeightM * 7.2) * (1.18 - stiffNorm * 0.62), 0.7, 9.5),
      1
    );
    var naturalFreqHz = roundTo(1.25 + stiffNorm * 2.15, 2);
    var dampingRatio = roundTo(0.36 + stiffNorm * 0.32, 2);

    /* Evasion & thermal/acoustic signature */
    var heatSignature = Math.round(
      clamp(v.baseNoiseDb * 0.62 + nitroNorm * 36 + (1 - gripNorm) * 8 - (v.id === 'stealth_enduro_bike' ? 10 : 0), 12, 99)
    );
    var evasionScore = Math.round(
      clamp(
        v.alleyAgility * 38 +
          tractionScore * 0.32 +
          (topSpeedKmh / 350) * 24 +
          (100 - heatSignature) * 0.22 -
          bodyRollDeg * 1.4,
        24,
        99
      )
    );

    return {
      vehicleId: v.id,
      item3d: v.item3d,
      cat3d: v.cat3d,
      massKg: v.massKg,
      driveType: v.driveType,
      armorRating: v.armorRating,
      tuning: t,
      effPowerHp: Math.round(effPowerHp),
      topSpeedKmh: topSpeedKmh,
      zeroToHundredSec: zeroToHundredSec,
      lateralG: lateralG,
      tractionScore: tractionScore,
      weightTransferPct: weightTransferPct,
      bodyRollDeg: bodyRollDeg,
      naturalFreqHz: naturalFreqHz,
      dampingRatio: dampingRatio,
      heatSignature: heatSignature,
      evasionScore: evasionScore
    };
  }

  /* ---------------- A* District Smuggling Corridor Pathfinder ---------------- */
  function buildAdjacency() {
    var adj = {};
    for (var i = 0; i < DISTRICTS.length; i++) {
      adj[DISTRICTS[i].id] = [];
    }
    for (var e = 0; e < CORRIDOR_EDGES.length; e++) {
      var edge = CORRIDOR_EDGES[e];
      adj[edge.from].push({
        from: edge.from,
        to: edge.to,
        distanceKm: edge.distanceKm,
        speedLimitKmh: edge.speedLimitKmh,
        alleyWidth: edge.alleyWidth,
        patrolIntensity: edge.patrolIntensity,
        roughness: edge.roughness
      });
      adj[edge.to].push({
        from: edge.to,
        to: edge.from,
        distanceKm: edge.distanceKm,
        speedLimitKmh: edge.speedLimitKmh,
        alleyWidth: edge.alleyWidth,
        patrolIntensity: edge.patrolIntensity,
        roughness: edge.roughness
      });
    }
    return adj;
  }

  var ADJACENCY = buildAdjacency();

  function evaluateCorridorEdge(edge, physics, policeAlertLevel) {
    var v = VEHICLE_MAP[physics.vehicleId] || VEHICLES[0];
    var alertNorm = clamp(policeAlertLevel != null ? policeAlertLevel : 35, 0, 100) / 100;

    var widthMult = 1.0;
    if (edge.alleyWidth === 'tight') {
      widthMult = v.alleyAgility >= 1.1 ? 1.18 : (v.massKg > 2400 ? 0.62 : 0.86);
    } else if (edge.alleyWidth === 'highway') {
      widthMult = 1.05 + (physics.topSpeedKmh - 160) / 360;
    }

    var roughPenalty = 1 - Math.max(0, (physics.tuning.suspensionStiffness - 76) / 100) * edge.roughness * 0.45;
    var gripSpeedBonus = 0.88 + (physics.tractionScore / 100) * 0.22;
    var effSpeedKmh = clamp(edge.speedLimitKmh * widthMult * roughPenalty * gripSpeedBonus, 24, physics.topSpeedKmh);
    var timeSec = Math.max(12, Math.round((edge.distanceKm / effSpeedKmh) * 3600));

    var destNode = DISTRICT_MAP[edge.to];
    var checkpointFactor = (destNode ? destNode.checkpoints : 2) * 0.045;
    var stealthMitigation = 1 - (physics.evasionScore / 100) * 0.42;
    var heatPenalty = 1 + (physics.heatSignature / 100) * 0.55;
    var armorMitigation = 1 - (v.armorRating / 100) * 0.18;
    var rawRisk = (edge.patrolIntensity * 0.72 + checkpointFactor) * (0.75 + alertNorm * 0.85) * heatPenalty * stealthMitigation * armorMitigation;
    var riskPct = roundTo(clamp(rawRisk * 100, 2, 82), 1);

    return {
      from: edge.from,
      to: edge.to,
      distanceKm: edge.distanceKm,
      alleyWidth: edge.alleyWidth,
      effSpeedKmh: roundTo(effSpeedKmh, 1),
      timeSec: timeSec,
      riskPct: riskPct
    };
  }

  /* Admissible Euclidean heuristic scaled by tightest optimistic speed & min risk */
  function computeCorridorHeuristic(nodeId, goalId, mode, maxSpeedKmh) {
    var a = DISTRICT_MAP[nodeId];
    var b = DISTRICT_MAP[goalId];
    if (!a || !b || nodeId === goalId) return 0;
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var euclidKm = Math.sqrt(dx * dx + dy * dy) * 0.045;
    var minTimeMin = (euclidKm / Math.max(140, maxSpeedKmh)) * 60;
    if (mode === 'fastest') {
      return minTimeMin;
    }
    return minTimeMin * 0.35;
  }

  function runSingleAStar(origin, destination, mode, physics, policeAlertLevel) {
    var start = DISTRICT_MAP[origin] ? origin : 'pier_4';
    var goal = DISTRICT_MAP[destination] ? destination : 'north_airstrip';

    if (start === goal) {
      return {
        mode: mode,
        origin: start,
        destination: goal,
        path: [start],
        legs: [],
        totalDistanceKm: 0,
        totalTimeSec: 0,
        totalCheckpointRiskPct: 0,
        estimatedHeatDelta: 0,
        nodesExpanded: 1,
        heuristicType: 'euclidean_admissible'
      };
    }

    var open = [start];
    var openSet = {};
    openSet[start] = true;
    var closedSet = {};
    var cameFrom = {};
    var cameEdge = {};
    var gScore = {};
    var fScore = {};

    for (var i = 0; i < DISTRICTS.length; i++) {
      gScore[DISTRICTS[i].id] = Infinity;
      fScore[DISTRICTS[i].id] = Infinity;
    }
    gScore[start] = 0;
    fScore[start] = computeCorridorHeuristic(start, goal, mode, physics.topSpeedKmh);

    var nodesExpanded = 0;
    while (open.length > 0) {
      var bestIdx = 0;
      for (var oi = 1; oi < open.length; oi++) {
        if (fScore[open[oi]] < fScore[open[bestIdx]]) bestIdx = oi;
      }
      var current = open.splice(bestIdx, 1)[0];
      delete openSet[current];
      nodesExpanded += 1;

      if (current === goal) {
        var path = [goal];
        var legs = [];
        var cur = goal;
        while (cameFrom[cur]) {
          legs.unshift(cameEdge[cur]);
          cur = cameFrom[cur];
          path.unshift(cur);
        }

        var totalDist = 0;
        var totalSec = 0;
        var safeProb = 1;
        for (var li = 0; li < legs.length; li++) {
          totalDist += legs[li].distanceKm;
          totalSec += legs[li].timeSec;
          safeProb *= (1 - legs[li].riskPct / 100);
        }
        var combinedRisk = roundTo(clamp((1 - safeProb) * 100, 1, 99), 1);
        var heatDelta = Math.round(combinedRisk * 0.24 + (physics.heatSignature / 100) * 6);

        return {
          mode: mode,
          origin: start,
          destination: goal,
          path: path,
          legs: legs,
          totalDistanceKm: roundTo(totalDist, 1),
          totalTimeSec: totalSec,
          totalCheckpointRiskPct: combinedRisk,
          estimatedHeatDelta: heatDelta,
          nodesExpanded: nodesExpanded,
          heuristicType: 'euclidean_admissible'
        };
      }

      closedSet[current] = true;
      var neighbors = ADJACENCY[current] || [];
      for (var ni = 0; ni < neighbors.length; ni++) {
        var edge = neighbors[ni];
        if (closedSet[edge.to]) continue;

        var evalLeg = evaluateCorridorEdge(edge, physics, policeAlertLevel);
        var timeMin = evalLeg.timeSec / 60;
        var stepCost = mode === 'fastest'
          ? (timeMin + evalLeg.riskPct * 0.08)
          : (evalLeg.riskPct * 1.45 + timeMin * 0.35);

        var tentativeG = gScore[current] + stepCost;
        if (tentativeG < gScore[edge.to]) {
          cameFrom[edge.to] = current;
          cameEdge[edge.to] = evalLeg;
          gScore[edge.to] = tentativeG;
          fScore[edge.to] = tentativeG + computeCorridorHeuristic(edge.to, goal, mode, physics.topSpeedKmh);
          if (!openSet[edge.to]) {
            open.push(edge.to);
            openSet[edge.to] = true;
          }
        }
      }
    }

    return null;
  }

  function findSmugglingRouteAStar(options) {
    var opts = options || {};
    var mode = opts.mode === 'fastest' ? 'fastest' : 'low_heat';
    var altMode = mode === 'low_heat' ? 'fastest' : 'low_heat';
    var physics = opts.physics || computeVehiclePhysics(opts.vehicleId || 'nightshade_gt', opts.tuning);
    var alertLvl = clamp(opts.policeAlertLevel != null ? opts.policeAlertLevel : 35, 0, 100);
    var origin = opts.origin || 'pier_4';
    var destination = opts.destination || 'north_airstrip';

    var primary = runSingleAStar(origin, destination, mode, physics, alertLvl);
    var alternate = runSingleAStar(origin, destination, altMode, physics, alertLvl);
    if (primary) {
      primary.alternateRoute = alternate;
    }
    return primary;
  }

  /* ---------------- Runtime Store & Bridges ---------------- */
  var store = {
    vehicleId: 'nightshade_gt',
    presetId: 'street',
    tuning: normalizeTuning(VEHICLES[0].defaults),
    origin: 'pier_4',
    destination: 'north_airstrip',
    routeMode: 'low_heat',
    policeAlertLevel: 35,
    mapClickTarget: 'origin',
    spring: { displacement: 0, velocity: 0 },
    feedback: null,
    lastItem3d: '',
    telemetry: {
      pulsesTriggered: 0,
      runsSimulated: 0,
      audioCuesFired: 0
    }
  };

  function getDoc() {
    return typeof document !== 'undefined' ? document : null;
  }

  function isAr() {
    var doc = getDoc();
    if (!doc || !doc.documentElement) return false;
    var html = doc.documentElement;
    return html.dir === 'rtl' || String(html.lang || '').toLowerCase().indexOf('ar') === 0;
  }

  function isReducedMotion() {
    var doc = getDoc();
    if (!doc || !doc.documentElement) return false;
    var html = doc.documentElement;
    return Boolean(html.dataset && html.dataset.zoneReducedMotion === 'true') ||
      (typeof html.getAttribute === 'function' && html.getAttribute('data-zone-reduced-motion') === 'true');
  }

  function L() {
    return isAr() ? I18N.ar : I18N.en;
  }

  function esc(val) {
    return String(val == null ? '' : val).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c;
    });
  }

  function fmtEta(sec) {
    var s = Math.max(0, Math.round(Number(sec) || 0));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function emitGarageBridge(stageAction, sfxCue, detail) {
    var payload = detail || {};
    if (root && root.ZoneEcs3D && typeof root.ZoneEcs3D.triggerStageAction === 'function') {
      try { root.ZoneEcs3D.triggerStageAction('city-wheels-race', stageAction || 'pulse', payload); } catch (_) {}
    }
    if (root && root.ZoneAudioHaptics) {
      try {
        if (typeof root.ZoneAudioHaptics.play === 'function') {
          root.ZoneAudioHaptics.play(sfxCue, payload);
        } else if (typeof root.ZoneAudioHaptics.trigger === 'function') {
          root.ZoneAudioHaptics.trigger(sfxCue, payload);
        }
      } catch (_) {}
    }
    store.telemetry.audioCuesFired += 1;
    try {
      if (root && typeof root.dispatchEvent === 'function' && typeof root.CustomEvent === 'function') {
        root.dispatchEvent(new root.CustomEvent('zone:audio-cue', { detail: { cue: sfxCue, stage: 'city-wheels-race', payload: payload } }));
        root.dispatchEvent(new root.CustomEvent('zone:vehicle-garage-event', { detail: { action: stageAction, cue: sfxCue, payload: payload } }));
      }
    } catch (_) {}
  }

  function pulse3dAndSpring(impulseVal, cueName) {
    var phys = computeVehiclePhysics(store.vehicleId, store.tuning);
    stepSuspensionSpring(store.spring, impulseVal != null ? impulseVal : 1.4, phys.tuning.suspensionStiffness / 100, 0.032, isReducedMotion());
    store.telemetry.pulsesTriggered += 1;
    emitGarageBridge('pulse', cueName || 'equip_snap', {
      vehicleId: phys.vehicleId,
      itemId: phys.item3d,
      nitroBoost: phys.tuning.nitroBoost,
      suspensionStiffness: phys.tuning.suspensionStiffness,
      topSpeedKmh: phys.topSpeedKmh,
      evasionScore: phys.evasionScore
    });
    return phys;
  }

  function simulateSmugglingRun(opts) {
    var o = opts || {};
    var vId = o.vehicleId || store.vehicleId;
    var tuning = o.tuning || store.tuning;
    var physics = computeVehiclePhysics(vId, tuning);
    var route = findSmugglingRouteAStar({
      origin: o.origin || store.origin,
      destination: o.destination || store.destination,
      mode: o.mode || store.routeMode,
      physics: physics,
      policeAlertLevel: o.policeAlertLevel != null ? o.policeAlertLevel : store.policeAlertLevel
    });
    store.telemetry.runsSimulated += 1;

    var deterministicRoll = typeof o.roll === 'number'
      ? o.roll
      : ((physics.evasionScore + route.totalCheckpointRiskPct * 0.7 + store.telemetry.runsSimulated * 13) % 100);
    var intercepted = route.totalCheckpointRiskPct > 55 && deterministicRoll < route.totalCheckpointRiskPct * 0.65;
    var cue = intercepted ? 'stealth_alert' : 'cash_payout';

    if (getDoc()) {
      var copy = L();
      var pathNames = route.path.map(function (id) {
        var d = DISTRICT_MAP[id];
        return d ? (isAr() ? d.ar : d.en) : id;
      }).join(isAr() ? ' ← ' : ' → ');

      store.feedback = {
        tone: intercepted ? 'crimson' : 'sage',
        text: (intercepted ? copy.runIntercept : copy.runSuccess) +
          ' [' + pathNames + ' · ' + fmtEta(route.totalTimeSec) + ' · ' + route.totalCheckpointRiskPct + '%]'
      };
      emitGarageBridge('pulse', cue, {
        vehicleId: physics.vehicleId,
        route: route.path,
        mode: route.mode,
        riskPct: route.totalCheckpointRiskPct,
        timeSec: route.totalTimeSec,
        intercepted: intercepted
      });
      renderGarageMount();
    }

    return {
      physics: physics,
      route: route,
      intercepted: intercepted,
      cue: cue
    };
  }

  /* ---------------- Route-Scoped DOM Detection (`city` & `travel` ONLY, 0 on `home`) ---------------- */
  function getActiveScreen() {
    var doc = getDoc();
    if (!doc) return '';
    var main = doc.getElementById('zone-main');
    if (!main) return '';
    return String(main.getAttribute('data-zone-screen') || '').toLowerCase();
  }

  function shouldMountOnCurrentScreen() {
    var doc = getDoc();
    if (!doc) return false;
    if (doc.querySelector && doc.querySelector('x-dc')) return false;
    var main = doc.getElementById('zone-main');
    if (!main) return false;

    var screen = getActiveScreen();
    /* Absolute rule: ZERO mounts on Home! */
    if (screen === 'home') return false;
    if (screen === 'city' || screen === 'travel') return true;

    /* Also mount when a travel panel is active on a non-home, non-unrelated route */
    if (!screen || screen === 'airport' || screen === 'museum') {
      if (main.querySelector && main.querySelector('[data-zone-travel-panel], [data-workspace="city"], .zone-city-travel-bar, [data-z3d-stage="city-wheels-race"]')) {
        return true;
      }
    }
    return Boolean(main.querySelector && main.querySelector('[data-zone-travel-panel], [data-ztl-abroad-shop]'));
  }

  function removeIfPresent(id) {
    var doc = getDoc();
    if (!doc) return;
    var el = doc.getElementById(id);
    if (el && el.parentElement) el.parentElement.removeChild(el);
  }

  /* ---------------- SVG Builders (Spring Telemetry + A* Corridor Map) ---------------- */
  function buildSpringSvgHtml(physics) {
    var amp = clamp(18 - (physics.tuning.suspensionStiffness / 100) * 10 + Math.abs(store.spring.displacement) * 8, 4, 24);
    var freq = 3 + Math.round((physics.naturalFreqHz - 1.2) * 2);
    var pts = ['M 6 38'];
    var coils = Math.max(4, Math.min(9, freq));
    var stepX = 168 / coils;
    for (var i = 0; i < coils; i++) {
      var xMid = 14 + i * stepX + stepX * 0.5;
      var xEnd = 14 + (i + 1) * stepX;
      var yOffset = (i % 2 === 0 ? -amp : amp);
      pts.push('L ' + roundTo(xMid, 1) + ' ' + roundTo(38 + yOffset, 1));
      pts.push('L ' + roundTo(xEnd, 1) + ' 38');
    }
    pts.push('L 194 38');
    var rollTilt = roundTo(clamp(physics.bodyRollDeg * 0.7, 0.5, 7), 1);

    return (
      '<svg class="zvg-spring-svg" viewBox="0 0 200 76" aria-hidden="true">' +
        '<line x1="6" y1="64" x2="194" y2="64" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.5" stroke-dasharray="4 3"/>' +
        '<g transform="rotate(' + (-rollTilt) + ' 100 38)">' +
          '<path d="' + pts.join(' ') + '" fill="none" stroke="var(--zvg-gold-fill)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</g>' +
        '<circle cx="100" cy="38" r="4" fill="var(--zvg-sage-fill)" stroke="var(--zvg-ink)" stroke-width="1.4"/>' +
      '</svg>'
    );
  }

  function pathToSvgPolyline(pathIds) {
    var coords = [];
    for (var i = 0; i < pathIds.length; i++) {
      var d = DISTRICT_MAP[pathIds[i]];
      if (d) coords.push(d.x + ',' + d.y);
    }
    return coords.join(' ');
  }

  function buildCorridorMapSvgHtml(route, ar) {
    var edgesHtml = '';
    for (var i = 0; i < CORRIDOR_EDGES.length; i++) {
      var e = CORRIDOR_EDGES[i];
      var da = DISTRICT_MAP[e.from];
      var db = DISTRICT_MAP[e.to];
      if (!da || !db) continue;
      edgesHtml += '<line class="zvg-edge-base" x1="' + da.x + '" y1="' + da.y + '" x2="' + db.x + '" y2="' + db.y + '"/>';
    }

    var altPoly = route && route.alternateRoute && route.alternateRoute.path.length > 1
      ? '<polyline class="zvg-edge-alt" points="' + pathToSvgPolyline(route.alternateRoute.path) + '"/>'
      : '';

    var activePoly = route && route.path.length > 1
      ? '<polyline class="zvg-edge-active" data-mode="' + esc(route.mode) + '" points="' + pathToSvgPolyline(route.path) + '"/>'
      : '';

    var onPath = {};
    if (route && route.path) {
      for (var p = 0; p < route.path.length; p++) onPath[route.path[p]] = true;
    }

    var nodesHtml = '';
    for (var di = 0; di < DISTRICTS.length; di++) {
      var d = DISTRICTS[di];
      var isOrigin = d.id === store.origin;
      var isDest = d.id === store.destination;
      var cls = 'zvg-node-circle' + (onPath[d.id] ? ' is-on-path' : '') + (isOrigin ? ' is-origin' : '') + (isDest ? ' is-dest' : '');
      var labelY = d.y < 28 ? d.y + 11 : d.y - 8;
      var anchor = d.x > 74 ? 'end' : (d.x < 24 ? 'start' : 'middle');
      var lbl = ar ? d.ar : d.en;
      nodesHtml +=
        '<g data-zvg-node="' + esc(d.id) + '">' +
          '<circle class="' + cls + '" cx="' + d.x + '" cy="' + d.y + '" r="' + (isOrigin || isDest ? 5.2 : 4.2) + '" data-zvg-act="pick-district" data-district="' + esc(d.id) + '"/>' +
          '<text class="zvg-node-lbl" x="' + d.x + '" y="' + labelY + '" text-anchor="' + anchor + '">' + esc(lbl) + '</text>' +
        '</g>';
    }

    return (
      '<svg class="zvg-map-svg" viewBox="0 0 100 100" role="img" aria-label="' + esc(L().plannerTitle) + '">' +
        edgesHtml +
        altPoly +
        activePoly +
        nodesHtml +
      '</svg>'
    );
  }

  /* ---------------- HTML Renderer & Targeted Live Slider Updates ---------------- */
  function buildGarageInnerHtml() {
    var ar = isAr();
    var copy = L();
    var v = VEHICLE_MAP[store.vehicleId] || VEHICLES[0];
    var physics = computeVehiclePhysics(store.vehicleId, store.tuning);
    var route = findSmugglingRouteAStar({
      origin: store.origin,
      destination: store.destination,
      mode: store.routeMode,
      physics: physics,
      policeAlertLevel: store.policeAlertLevel
    });

    var fleetHtml = '<div class="zvg-fleet-grid">';
    for (var vi = 0; vi < VEHICLES.length; vi++) {
      var veh = VEHICLES[vi];
      var active = veh.id === store.vehicleId;
      fleetHtml +=
        '<button type="button" class="zvg-vehicle-btn' + (active ? ' is-active' : '') + '" data-zvg-act="select-vehicle" data-vehicle="' + esc(veh.id) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
          '<span class="zvg-v-name">' + esc(ar ? veh.ar : veh.en) + '</span>' +
          '<span class="zvg-v-meta"><bdi>' + veh.driveType + '</bdi> · ' + esc(ar ? veh.classAr : veh.classEn) + '</span>' +
        '</button>';
    }
    fleetHtml += '</div>';

    var presetsHtml = '<div class="zvg-presets">';
    var presetKeys = ['street', 'track', 'ghost'];
    for (var pi = 0; pi < presetKeys.length; pi++) {
      var pr = TUNING_PRESETS[presetKeys[pi]];
      presetsHtml +=
        '<button type="button" class="zvg-btn' + (store.presetId === pr.id ? ' is-active' : '') + '" data-zvg-act="apply-preset" data-preset="' + esc(pr.id) + '">' +
          esc(ar ? pr.ar : pr.en) +
        '</button>';
    }
    presetsHtml += '</div>';

    var slidersHtml =
      '<div class="zvg-sliders">' +
        '<div class="zvg-slider-card">' +
          '<div class="zvg-slider-top"><span>' + esc(copy.lblSuspension) + '</span><bdi class="zvg-slider-val" data-zvg-val="suspensionStiffness">' + physics.tuning.suspensionStiffness + '%</bdi></div>' +
          '<input class="zvg-range" type="range" min="15" max="100" step="1" value="' + physics.tuning.suspensionStiffness + '" data-zvg-tune="suspensionStiffness" aria-label="' + esc(copy.lblSuspension) + '">' +
        '</div>' +
        '<div class="zvg-slider-card">' +
          '<div class="zvg-slider-top"><span>' + esc(copy.lblGearRatio) + '</span><bdi class="zvg-slider-val" data-zvg-val="gearRatio">' + physics.tuning.gearRatio.toFixed(2) + ':1</bdi></div>' +
          '<input class="zvg-range" type="range" min="2.40" max="4.90" step="0.05" value="' + physics.tuning.gearRatio + '" data-zvg-tune="gearRatio" aria-label="' + esc(copy.lblGearRatio) + '">' +
        '</div>' +
        '<div class="zvg-slider-card">' +
          '<div class="zvg-slider-top"><span>' + esc(copy.lblTireGrip) + '</span><bdi class="zvg-slider-val" data-zvg-val="tireGrip">' + physics.tuning.tireGrip + '%</bdi></div>' +
          '<input class="zvg-range" type="range" min="30" max="100" step="1" value="' + physics.tuning.tireGrip + '" data-zvg-tune="tireGrip" aria-label="' + esc(copy.lblTireGrip) + '">' +
        '</div>' +
        '<div class="zvg-slider-card">' +
          '<div class="zvg-slider-top"><span>' + esc(copy.lblNitro) + '</span><bdi class="zvg-slider-val" data-zvg-val="nitroBoost">' + physics.tuning.nitroBoost + '%</bdi></div>' +
          '<input class="zvg-range" type="range" min="0" max="100" step="1" value="' + physics.tuning.nitroBoost + '" data-zvg-tune="nitroBoost" aria-label="' + esc(copy.lblNitro) + '">' +
        '</div>' +
      '</div>';

    var kpisHtml =
      '<div class="zvg-kpi-grid" data-zvg-kpi-grid="1">' +
        '<div class="zvg-kpi">' +
          '<div class="zvg-kpi-lbl">' + esc(copy.kpiTransfer) + '</div>' +
          '<div class="zvg-kpi-val" data-zvg-kpi="transfer"><bdi>' + physics.weightTransferPct + '% · ' + physics.bodyRollDeg + '°</bdi></div>' +
          '<div class="zvg-bar-track"><div class="zvg-bar-fill" data-tone="gold" data-zvg-bar="transfer" style="width:' + clamp(physics.weightTransferPct * 2, 8, 100) + '%"></div></div>' +
        '</div>' +
        '<div class="zvg-kpi">' +
          '<div class="zvg-kpi-lbl">' + esc(copy.kpiTraction) + '</div>' +
          '<div class="zvg-kpi-val" data-zvg-kpi="traction"><bdi>' + physics.tractionScore + '/100 · ' + physics.lateralG + 'G</bdi></div>' +
          '<div class="zvg-bar-track"><div class="zvg-bar-fill" data-tone="sage" data-zvg-bar="traction" style="width:' + physics.tractionScore + '%"></div></div>' +
        '</div>' +
        '<div class="zvg-kpi">' +
          '<div class="zvg-kpi-lbl">' + esc(copy.kpiSpeed) + '</div>' +
          '<div class="zvg-kpi-val" data-zvg-kpi="speed"><bdi>' + physics.topSpeedKmh + ' km/h · ' + physics.zeroToHundredSec + 's</bdi></div>' +
          '<div class="zvg-bar-track"><div class="zvg-bar-fill" data-tone="blue" data-zvg-bar="speed" style="width:' + clamp(Math.round((physics.topSpeedKmh / 390) * 100), 10, 100) + '%"></div></div>' +
        '</div>' +
        '<div class="zvg-kpi">' +
          '<div class="zvg-kpi-lbl">' + esc(copy.kpiEvasion) + '</div>' +
          '<div class="zvg-kpi-val" data-zvg-kpi="evasion"><bdi>' + physics.evasionScore + '/100 · 🔥' + physics.heatSignature + '</bdi></div>' +
          '<div class="zvg-bar-track"><div class="zvg-bar-fill" data-tone="' + (physics.evasionScore >= 65 ? 'sage' : 'crimson') + '" data-zvg-bar="evasion" style="width:' + physics.evasionScore + '%"></div></div>' +
        '</div>' +
      '</div>';

    var originOpts = '';
    var destOpts = '';
    for (var oi = 0; oi < DISTRICTS.length; oi++) {
      var dist = DISTRICTS[oi];
      var dLbl = ar ? dist.ar : dist.en;
      originOpts += '<option value="' + esc(dist.id) + '"' + (store.origin === dist.id ? ' selected' : '') + '>' + esc(dLbl) + '</option>';
      destOpts += '<option value="' + esc(dist.id) + '"' + (store.destination === dist.id ? ' selected' : '') + '>' + esc(dLbl) + '</option>';
    }

    var legsHtml = '<div class="zvg-route-legs" data-zvg-legs="1">';
    if (route && route.legs) {
      for (var li = 0; li < route.legs.length; li++) {
        var leg = route.legs[li];
        var fNode = DISTRICT_MAP[leg.from];
        var tNode = DISTRICT_MAP[leg.to];
        var fName = fNode ? (ar ? fNode.ar : fNode.en) : leg.from;
        var tName = tNode ? (ar ? tNode.ar : tNode.en) : leg.to;
        legsHtml +=
          '<div class="zvg-leg-row">' +
            '<span>' + esc(fName) + (ar ? ' ← ' : ' → ') + esc(tName) + '</span>' +
            '<bdi>' + fmtEta(leg.timeSec) + ' · ' + leg.riskPct + '%</bdi>' +
          '</div>';
      }
    }
    legsHtml += '</div>';

    var altSummary = '';
    if (route && route.alternateRoute) {
      var alt = route.alternateRoute;
      altSummary =
        '<div class="zvg-compare-strip" data-zvg-compare="1">' +
          esc(copy.comparePrefix) + ' (' + esc(alt.mode === 'fastest' ? copy.modeFastest : copy.modeLowHeat) + '): ' +
          '<bdi>' + fmtEta(alt.totalTimeSec) + ' · ' + alt.totalCheckpointRiskPct + '% · ' + alt.path.length + ' nodes</bdi>' +
        '</div>';
    }

    var fbHtml = store.feedback
      ? '<div class="zvg-feedback" role="status" data-tone="' + esc(store.feedback.tone) + '">' +
          '<span>' + esc(store.feedback.text) + '</span>' +
          '<button type="button" class="zvg-btn" data-zvg-act="clear-feedback" aria-label="Close">✕</button>' +
        '</div>'
      : '';

    return (
      '<header class="zvg-head">' +
        '<div class="zvg-title-wrap">' +
          '<span class="zvg-crest" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M3 14h18l-2-5H6l-3 5z"/>' +
              '<circle cx="7" cy="16.5" r="2.2"/>' +
              '<circle cx="17" cy="16.5" r="2.2"/>' +
            '</svg>' +
          '</span>' +
          '<div>' +
            '<h3 class="zvg-title">' + esc(copy.title) + '</h3>' +
            '<p class="zvg-sub">' + esc(copy.subtitle) + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="zvg-badges">' +
          '<span class="zvg-pill" data-tone="gold">' + esc(copy.badgeMode) + '</span>' +
          '<span class="zvg-pill" data-tone="sage" data-zvg-hp-pill="1"><bdi>' + physics.effPowerHp + ' HP · ' + physics.massKg + ' kg</bdi></span>' +
        '</div>' +
      '</header>' +
      '<div class="zvg-layout">' +
        '<section class="zvg-panel" data-zvg-panel="workbench">' +
          '<div class="zvg-panel-head">' +
            '<h4 class="zvg-panel-title">' + esc(copy.fleetTitle) + '</h4>' +
            '<span class="zvg-pill" data-tone="blue"><bdi>' + esc(ar ? v.ar : v.en) + '</bdi></span>' +
          '</div>' +
          fleetHtml +
          '<div class="zvg-preview-row">' +
            '<div class="zvg-3d-box">' +
              '<div class="z3d-item-slot" data-z3d-item="' + esc(physics.item3d) + '" data-z3d-cat="' + esc(physics.cat3d) + '"></div>' +
              '<div class="zvg-3d-actions">' +
                '<button type="button" class="zvg-btn" data-z3d-inspect="' + esc(physics.item3d) + '" data-z3d-cat="' + esc(physics.cat3d) + '" data-z3d-title="' + esc(ar ? v.ar : v.en) + '">' + esc(copy.inspect3d) + '</button>' +
                '<button type="button" class="zvg-btn" data-variant="gold" data-zvg-act="pulse-3d">' + esc(copy.pulse3d) + '</button>' +
              '</div>' +
            '</div>' +
            '<div class="zvg-spring-box" data-zvg-spring-box="1">' +
              '<div class="zvg-spring-caption"><span>' + esc(copy.springTelemetry) + '</span><bdi data-zvg-freq="1">' + physics.naturalFreqHz + ' Hz · ζ ' + physics.dampingRatio + '</bdi></div>' +
              buildSpringSvgHtml(physics) +
            '</div>' +
          '</div>' +
          '<div class="zvg-panel-head">' +
            '<h4 class="zvg-panel-title">' + esc(copy.tuningTitle) + '</h4>' +
          '</div>' +
          presetsHtml +
          slidersHtml +
          kpisHtml +
        '</section>' +
        '<section class="zvg-panel" data-zvg-panel="corridor">' +
          '<div class="zvg-panel-head">' +
            '<h4 class="zvg-panel-title">' + esc(copy.plannerTitle) + '</h4>' +
            '<span class="zvg-pill" data-tone="crimson"><bdi>' + esc(copy.alertLbl) + ': ' + store.policeAlertLevel + '%</bdi></span>' +
          '</div>' +
          '<div class="zvg-route-controls">' +
            '<label class="zvg-field"><span class="zvg-field-lbl">' + esc(copy.originLbl) + '</span><select class="zvg-select" data-zvg-select="origin">' + originOpts + '</select></label>' +
            '<label class="zvg-field"><span class="zvg-field-lbl">' + esc(copy.destLbl) + '</span><select class="zvg-select" data-zvg-select="destination">' + destOpts + '</select></label>' +
          '</div>' +
          '<div class="zvg-mode-row">' +
            '<div class="zvg-mode-group">' +
              '<button type="button" class="zvg-btn' + (store.routeMode === 'low_heat' ? ' is-active' : '') + '" data-variant="primary" data-zvg-act="set-mode" data-mode="low_heat">' + esc(copy.modeLowHeat) + '</button>' +
              '<button type="button" class="zvg-btn' + (store.routeMode === 'fastest' ? ' is-active' : '') + '" data-variant="blue" data-zvg-act="set-mode" data-mode="fastest">' + esc(copy.modeFastest) + '</button>' +
            '</div>' +
            '<div class="zvg-slider-card" style="flex:1 1 130px">' +
              '<div class="zvg-slider-top"><span>' + esc(copy.alertLbl) + '</span><bdi class="zvg-slider-val" data-zvg-val="policeAlertLevel">' + store.policeAlertLevel + '%</bdi></div>' +
              '<input class="zvg-range" type="range" min="0" max="100" step="5" value="' + store.policeAlertLevel + '" data-zvg-tune="policeAlertLevel" aria-label="' + esc(copy.alertLbl) + '">' +
            '</div>' +
          '</div>' +
          '<div class="zvg-map-wrap" data-zvg-map-wrap="1">' +
            buildCorridorMapSvgHtml(route, ar) +
            '<div class="zvg-spring-caption"><span>' + esc(copy.clickHint) + '</span><bdi>' + (route ? route.totalDistanceKm : 0) + ' km</bdi></div>' +
          '</div>' +
          '<div class="zvg-route-summary">' +
            '<div class="zvg-route-stat"><div class="zvg-kpi-lbl">' + esc(copy.etaLbl) + '</div><div class="zvg-kpi-val" data-zvg-route-eta="1"><bdi>' + (route ? fmtEta(route.totalTimeSec) : '0:00') + '</bdi></div></div>' +
            '<div class="zvg-route-stat"><div class="zvg-kpi-lbl">' + esc(copy.riskLbl) + '</div><div class="zvg-kpi-val" data-zvg-route-risk="1"><bdi>' + (route ? route.totalCheckpointRiskPct : 0) + '%</bdi></div></div>' +
            '<div class="zvg-route-stat"><div class="zvg-kpi-lbl">' + esc(copy.nodesLbl) + '</div><div class="zvg-kpi-val" data-zvg-route-nodes="1"><bdi>' + (route ? route.nodesExpanded : 0) + ' (' + (route ? route.path.length : 0) + ')</bdi></div></div>' +
          '</div>' +
          legsHtml +
          altSummary +
          '<div class="zvg-dispatch-row">' +
            '<button type="button" class="zvg-btn" data-variant="gold" data-zvg-act="run-corridor">' + esc(copy.runSmuggleBtn) + '</button>' +
          '</div>' +
        '</section>' +
      '</div>' +
      fbHtml
    );
  }

  function updateTuningReadoutsLive(hub) {
    if (!hub || !hub.querySelector) return;
    var ar = isAr();
    var copy = L();
    var physics = computeVehiclePhysics(store.vehicleId, store.tuning);
    var route = findSmugglingRouteAStar({
      origin: store.origin,
      destination: store.destination,
      mode: store.routeMode,
      physics: physics,
      policeAlertLevel: store.policeAlertLevel
    });

    var valSus = hub.querySelector('[data-zvg-val="suspensionStiffness"]');
    if (valSus) valSus.textContent = physics.tuning.suspensionStiffness + '%';
    var valGear = hub.querySelector('[data-zvg-val="gearRatio"]');
    if (valGear) valGear.textContent = physics.tuning.gearRatio.toFixed(2) + ':1';
    var valGrip = hub.querySelector('[data-zvg-val="tireGrip"]');
    if (valGrip) valGrip.textContent = physics.tuning.tireGrip + '%';
    var valNitro = hub.querySelector('[data-zvg-val="nitroBoost"]');
    if (valNitro) valNitro.textContent = physics.tuning.nitroBoost + '%';
    var valAlert = hub.querySelector('[data-zvg-val="policeAlertLevel"]');
    if (valAlert) valAlert.textContent = store.policeAlertLevel + '%';

    var hpPill = hub.querySelector('[data-zvg-hp-pill]');
    if (hpPill) hpPill.innerHTML = '<bdi>' + physics.effPowerHp + ' HP · ' + physics.massKg + ' kg</bdi>';

    var kpiTransfer = hub.querySelector('[data-zvg-kpi="transfer"]');
    if (kpiTransfer) kpiTransfer.innerHTML = '<bdi>' + physics.weightTransferPct + '% · ' + physics.bodyRollDeg + '°</bdi>';
    var barTransfer = hub.querySelector('[data-zvg-bar="transfer"]');
    if (barTransfer && barTransfer.style) barTransfer.style.width = clamp(physics.weightTransferPct * 2, 8, 100) + '%';

    var kpiTraction = hub.querySelector('[data-zvg-kpi="traction"]');
    if (kpiTraction) kpiTraction.innerHTML = '<bdi>' + physics.tractionScore + '/100 · ' + physics.lateralG + 'G</bdi>';
    var barTraction = hub.querySelector('[data-zvg-bar="traction"]');
    if (barTraction && barTraction.style) barTraction.style.width = physics.tractionScore + '%';

    var kpiSpeed = hub.querySelector('[data-zvg-kpi="speed"]');
    if (kpiSpeed) kpiSpeed.innerHTML = '<bdi>' + physics.topSpeedKmh + ' km/h · ' + physics.zeroToHundredSec + 's</bdi>';
    var barSpeed = hub.querySelector('[data-zvg-bar="speed"]');
    if (barSpeed && barSpeed.style) barSpeed.style.width = clamp(Math.round((physics.topSpeedKmh / 390) * 100), 10, 100) + '%';

    var kpiEvasion = hub.querySelector('[data-zvg-kpi="evasion"]');
    if (kpiEvasion) kpiEvasion.innerHTML = '<bdi>' + physics.evasionScore + '/100 · 🔥' + physics.heatSignature + '</bdi>';
    var barEvasion = hub.querySelector('[data-zvg-bar="evasion"]');
    if (barEvasion && barEvasion.style) barEvasion.style.width = physics.evasionScore + '%';

    var freqEl = hub.querySelector('[data-zvg-freq]');
    if (freqEl) freqEl.textContent = physics.naturalFreqHz + ' Hz · ζ ' + physics.dampingRatio;

    var springBox = hub.querySelector('[data-zvg-spring-box]');
    if (springBox) {
      var oldSvg = springBox.querySelector('.zvg-spring-svg');
      if (oldSvg) oldSvg.outerHTML = buildSpringSvgHtml(physics);
    }

    if (route) {
      var etaEl = hub.querySelector('[data-zvg-route-eta]');
      if (etaEl) etaEl.innerHTML = '<bdi>' + fmtEta(route.totalTimeSec) + '</bdi>';
      var riskEl = hub.querySelector('[data-zvg-route-risk]');
      if (riskEl) riskEl.innerHTML = '<bdi>' + route.totalCheckpointRiskPct + '%</bdi>';
      var nodesEl = hub.querySelector('[data-zvg-route-nodes]');
      if (nodesEl) nodesEl.innerHTML = '<bdi>' + route.nodesExpanded + ' (' + route.path.length + ')</bdi>';

      var mapWrap = hub.querySelector('[data-zvg-map-wrap]');
      if (mapWrap) {
        mapWrap.innerHTML = buildCorridorMapSvgHtml(route, ar) +
          '<div class="zvg-spring-caption"><span>' + esc(copy.clickHint) + '</span><bdi>' + route.totalDistanceKm + ' km</bdi></div>';
      }

      var legsBox = hub.querySelector('[data-zvg-legs]');
      if (legsBox) {
        var lh = '';
        for (var li = 0; li < route.legs.length; li++) {
          var leg = route.legs[li];
          var fn = DISTRICT_MAP[leg.from];
          var tn = DISTRICT_MAP[leg.to];
          lh += '<div class="zvg-leg-row"><span>' + esc(fn ? (ar ? fn.ar : fn.en) : leg.from) + (ar ? ' ← ' : ' → ') + esc(tn ? (ar ? tn.ar : tn.en) : leg.to) + '</span><bdi>' + fmtEta(leg.timeSec) + ' · ' + leg.riskPct + '%</bdi></div>';
        }
        legsBox.innerHTML = lh;
      }

      var cmp = hub.querySelector('[data-zvg-compare]');
      if (cmp && route.alternateRoute) {
        var alt = route.alternateRoute;
        cmp.innerHTML = esc(copy.comparePrefix) + ' (' + esc(alt.mode === 'fastest' ? copy.modeFastest : copy.modeLowHeat) + '): ' +
          '<bdi>' + fmtEta(alt.totalTimeSec) + ' · ' + alt.totalCheckpointRiskPct + '% · ' + alt.path.length + ' nodes</bdi>';
      }
    }
  }

  function renderGarageMount() {
    var doc = getDoc();
    if (!doc) return false;

    if (!shouldMountOnCurrentScreen()) {
      removeIfPresent('zvg-garage-hub');
      return false;
    }

    var main = doc.getElementById('zone-main');
    if (!main) return false;
    var screen = getActiveScreen() || 'travel';

    var hub = doc.getElementById('zvg-garage-hub');
    if (!hub) {
      hub = doc.createElement('section');
      hub.id = 'zvg-garage-hub';
      hub.className = 'zvg-scope';
    }
    hub.setAttribute('data-zvg-mounted', screen);

    var stageAnchor = main.querySelector ? main.querySelector('[data-z3d-stage="city-wheels-race"]') : null;
    var cityWorkspace = main.querySelector ? main.querySelector('[data-workspace="city"], [data-zre-feature="city-underworld"]') : null;
    if (stageAnchor && stageAnchor.parentElement) {
      if (stageAnchor.nextElementSibling !== hub) {
        stageAnchor.insertAdjacentElement('afterend', hub);
      }
    } else if (cityWorkspace && cityWorkspace.parentElement) {
      if (cityWorkspace.nextElementSibling !== hub) {
        cityWorkspace.insertAdjacentElement('afterend', hub);
      }
    } else if (!hub.parentElement) {
      main.appendChild(hub);
    }

    var activeEl = doc.activeElement;
    if (activeEl && hub.contains && hub.contains(activeEl) && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT')) {
      updateTuningReadoutsLive(hub);
      return true;
    }

    var v = VEHICLE_MAP[store.vehicleId] || VEHICLES[0];
    var prevSlot = hub.querySelector ? hub.querySelector('.z3d-item-slot') : null;
    var preserveSlot = Boolean(prevSlot && prevSlot.querySelector && prevSlot.querySelector('canvas') && store.lastItem3d === v.item3d);

    hub.innerHTML = buildGarageInnerHtml();
    if (preserveSlot && hub.querySelector) {
      var nextSlot = hub.querySelector('.z3d-item-slot');
      if (nextSlot && typeof nextSlot.replaceWith === 'function') {
        nextSlot.replaceWith(prevSlot);
      }
    }

    if (store.lastItem3d !== v.item3d || !preserveSlot) {
      store.lastItem3d = v.item3d;
      if (root && root.ZoneEcs3D && typeof root.ZoneEcs3D.scan === 'function') {
        try { root.ZoneEcs3D.scan(hub); } catch (_) {}
      }
    }
    return true;
  }

  /* ---------------- Event Wiring & Lifecycle ---------------- */
  var syncScheduled = false;
  function scheduleSync() {
    if (syncScheduled) return;
    syncScheduled = true;
    var run = function () {
      syncScheduled = false;
      renderGarageMount();
    };
    if (root && typeof root.requestAnimationFrame === 'function') {
      root.requestAnimationFrame(run);
    } else {
      setTimeout(run, 16);
    }
  }

  function handleDocClick(ev) {
    var target = ev.target && typeof ev.target.closest === 'function' ? ev.target.closest('[data-zvg-act]') : null;
    if (!target || target.disabled) return;
    var act = target.getAttribute('data-zvg-act');

    if (act === 'select-vehicle') {
      if (ev.preventDefault) ev.preventDefault();
      var vid = target.getAttribute('data-vehicle');
      if (VEHICLE_MAP[vid]) {
        store.vehicleId = vid;
        store.presetId = 'custom';
        store.tuning = normalizeTuning(VEHICLE_MAP[vid].defaults);
        pulse3dAndSpring(1.1, 'equip_snap');
        renderGarageMount();
      }
    } else if (act === 'apply-preset') {
      if (ev.preventDefault) ev.preventDefault();
      var pid = target.getAttribute('data-preset');
      if (TUNING_PRESETS[pid]) {
        store.presetId = pid;
        store.tuning = normalizeTuning(TUNING_PRESETS[pid].tuning);
        pulse3dAndSpring(1.3, 'ui_nav');
        renderGarageMount();
      }
    } else if (act === 'pulse-3d') {
      if (ev.preventDefault) ev.preventDefault();
      pulse3dAndSpring(1.8, 'equip_snap');
      store.feedback = { tone: 'gold', text: L().pulseMsg };
      renderGarageMount();
    } else if (act === 'set-mode') {
      if (ev.preventDefault) ev.preventDefault();
      store.routeMode = target.getAttribute('data-mode') === 'fastest' ? 'fastest' : 'low_heat';
      emitGarageBridge('pulse', 'ui_nav', { mode: store.routeMode });
      renderGarageMount();
    } else if (act === 'pick-district') {
      if (ev.preventDefault) ev.preventDefault();
      var dId = target.getAttribute('data-district');
      if (DISTRICT_MAP[dId]) {
        if (store.mapClickTarget === 'origin') {
          if (dId !== store.destination) store.origin = dId;
          store.mapClickTarget = 'destination';
        } else {
          if (dId !== store.origin) store.destination = dId;
          store.mapClickTarget = 'origin';
        }
        emitGarageBridge('pulse', 'ui_nav', { origin: store.origin, destination: store.destination });
        renderGarageMount();
      }
    } else if (act === 'run-corridor') {
      if (ev.preventDefault) ev.preventDefault();
      simulateSmugglingRun();
    } else if (act === 'clear-feedback') {
      if (ev.preventDefault) ev.preventDefault();
      store.feedback = null;
      renderGarageMount();
    }
  }

  function handleDocInput(ev) {
    var el = ev.target;
    if (!el || !el.getAttribute) return;
    var tuneKey = el.getAttribute('data-zvg-tune');
    if (tuneKey) {
      if (tuneKey === 'policeAlertLevel') {
        store.policeAlertLevel = clamp(el.value, 0, 100);
      } else if (Object.prototype.hasOwnProperty.call(store.tuning, tuneKey)) {
        store.tuning[tuneKey] = tuneKey === 'gearRatio' ? roundTo(clamp(el.value, 2.4, 4.9), 2) : clamp(el.value, 0, 100);
        store.presetId = 'custom';
      }
      var doc = getDoc();
      var hub = doc ? doc.getElementById('zvg-garage-hub') : null;
      if (hub) updateTuningReadoutsLive(hub);
      return;
    }

    var selKey = el.getAttribute('data-zvg-select');
    if (selKey === 'origin' && DISTRICT_MAP[el.value]) {
      store.origin = el.value;
      renderGarageMount();
    } else if (selKey === 'destination' && DISTRICT_MAP[el.value]) {
      store.destination = el.value;
      renderGarageMount();
    }
  }

  function boot() {
    var doc = getDoc();
    if (!doc) return;
    doc.addEventListener('click', handleDocClick);
    doc.addEventListener('input', handleDocInput);
    doc.addEventListener('change', handleDocInput);

    if (root && typeof root.addEventListener === 'function') {
      root.addEventListener('zone:render', scheduleSync);
      root.addEventListener('zone:ecs-3d-ready', scheduleSync);
    }

    if (typeof MutationObserver === 'function' && doc.documentElement) {
      var rootObs = new MutationObserver(function () {
        if (isReducedMotion()) {
          store.spring.displacement = 0;
          store.spring.velocity = 0;
        }
        scheduleSync();
      });
      rootObs.observe(doc.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme', 'dir', 'lang', 'data-zone-reduced-motion', 'data-zone-contrast']
      });

      var mainObs = null;
      var observedMain = null;
      var attachMainObserver = function () {
        var m = doc.getElementById('zone-main');
        if (!m || m === observedMain) return;
        if (mainObs) {
          try { mainObs.disconnect(); } catch (_) {}
        }
        observedMain = m;
        mainObs = new MutationObserver(function (records) {
          for (var i = 0; i < records.length; i++) {
            var rec = records[i];
            if (rec.type === 'attributes') {
              scheduleSync();
              return;
            }
            if (rec.type === 'childList' && rec.target === m) {
              var nodes = rec.addedNodes || [];
              for (var n = 0; n < nodes.length; n++) {
                var nd = nodes[n];
                if (!nd || nd.nodeType !== 1 || nd.id === 'zvg-garage-hub') continue;
                scheduleSync();
                return;
              }
            }
          }
        });
        mainObs.observe(m, {
          attributes: true,
          attributeFilter: ['data-zone-screen'],
          childList: true
        });
      };

      attachMainObserver();
      if (!observedMain) {
        var bootTries = 0;
        var bootPoll = setInterval(function () {
          bootTries += 1;
          attachMainObserver();
          if (observedMain || bootTries >= 40) {
            clearInterval(bootPoll);
            if (observedMain) scheduleSync();
          }
        }, 150);
      }
      if (root && typeof root.addEventListener === 'function') {
        root.addEventListener('zone:render', attachMainObserver);
      }
    }

    scheduleSync();
  }

  var api = {
    VEHICLES: VEHICLES,
    DISTRICTS: DISTRICTS,
    CORRIDOR_EDGES: CORRIDOR_EDGES,
    TUNING_PRESETS: TUNING_PRESETS,
    I18N: I18N,
    clamp: clamp,
    expSmooth: expSmooth,
    stepSuspensionSpring: stepSuspensionSpring,
    normalizeTuning: normalizeTuning,
    computeVehiclePhysics: computeVehiclePhysics,
    computeCorridorHeuristic: computeCorridorHeuristic,
    evaluateCorridorEdge: evaluateCorridorEdge,
    findSmugglingRouteAStar: findSmugglingRouteAStar,
    simulateSmugglingRun: simulateSmugglingRun,
    pulse3dAndSpring: pulse3dAndSpring,
    shouldMountOnCurrentScreen: shouldMountOnCurrentScreen,
    render: renderGarageMount,
    getState: function () {
      return {
        vehicleId: store.vehicleId,
        presetId: store.presetId,
        tuning: normalizeTuning(store.tuning),
        origin: store.origin,
        destination: store.destination,
        routeMode: store.routeMode,
        policeAlertLevel: store.policeAlertLevel,
        spring: { displacement: store.spring.displacement, velocity: store.spring.velocity }
      };
    },
    setState: function (patch) {
      if (!patch || typeof patch !== 'object') return api.getState();
      if (patch.vehicleId && VEHICLE_MAP[patch.vehicleId]) store.vehicleId = patch.vehicleId;
      if (patch.tuning) store.tuning = normalizeTuning(patch.tuning);
      if (patch.origin && DISTRICT_MAP[patch.origin]) store.origin = patch.origin;
      if (patch.destination && DISTRICT_MAP[patch.destination]) store.destination = patch.destination;
      if (patch.routeMode === 'fastest' || patch.routeMode === 'low_heat') store.routeMode = patch.routeMode;
      if (patch.policeAlertLevel != null) store.policeAlertLevel = clamp(patch.policeAlertLevel, 0, 100);
      renderGarageMount();
      return api.getState();
    },
    diagnostics: function () {
      var doc = getDoc();
      var hub = doc ? doc.getElementById('zvg-garage-hub') : null;
      return {
        ready: true,
        screen: getActiveScreen(),
        mounted: Boolean(hub),
        vehicleId: store.vehicleId,
        routeMode: store.routeMode,
        telemetry: store.telemetry
      };
    }
  };

  if (root) {
    root.ZoneVehicleGarage = api;
    root.__ZoneVehicleGarage157 = api;
  }

  var doc = getDoc();
  if (doc) {
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
