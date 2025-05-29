/**
 * Sample file with intentional issues for testing
 */

function processData(data) {
  // TODO: Implement proper validation
  console.log("Processing data:", data);

  try {
    const result = JSON.parse(data);
    return result;
  } catch (e) {} // Empty catch block

  return null;
}

function formatOutput(data) {
  if (data === null) {
    console.log("Data is null");
    return;
  }

  // TODO: Improve formatting
  return JSON.stringify(data, null, 2);
}

// Export functions
module.exports = {
  processData,
  formatOutput,
};
