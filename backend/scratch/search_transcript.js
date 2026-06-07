const fs = require('fs');
const readline = require('readline');

const logFilePath = 'C:\\Users\\anton\\.gemini\\antigravity\\brain\\2e2ab286-bac2-449a-b984-164119aa820c\\.system_generated\\logs\\transcript.jsonl';

async function searchTranscript() {
  const fileStream = fs.createReadStream(logFilePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.includes('gps_logs')) {
      try {
        const obj = JSON.parse(line);
        console.log(`Step ${obj.step_index} (${obj.type}):`);
        if (obj.tool_calls) {
          console.log(`Tool Calls:`, JSON.stringify(obj.tool_calls, null, 2));
        } else if (obj.content) {
          console.log(`Content Snippet:`, obj.content.substring(0, 500));
        }
      } catch (err) {
        console.log(`Raw match:`, line.substring(0, 300));
      }
    }
  }
}

searchTranscript().catch(err => console.error(err));
