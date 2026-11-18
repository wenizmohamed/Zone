import { inspect } from 'node:util';

// Successful negative-path test names can be mistaken for build errors by log
// viewers. Print summaries instead; preserve failure details and test output.
export default async function* buildTestReporter(source) {
  for await (const { type, data } of source) {
    switch (type) {
      case 'test:fail':
        yield `FAIL: ${data.name}\n${inspect(data.details.error, { depth: 8, colors: false })}\n`;
        break;
      case 'test:diagnostic':
        yield `${data.message}\n`;
        break;
      case 'test:stderr':
      case 'test:stdout':
        yield data.message;
        break;
    }
  }
}
