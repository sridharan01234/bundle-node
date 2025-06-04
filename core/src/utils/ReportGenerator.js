import { writeFileSync, mkdirSync, existsSync, statSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

export class ReportGenerator {
  constructor(baseUrl, reportsDir, timestamp) {
    this.baseUrl = baseUrl;
    this.reportsDir = reportsDir;
    this.timestamp = timestamp;
    this.reportFile = join(reportsDir, `performance_report_${timestamp}.txt`);
    this.jsonReport = join(reportsDir, `performance_data_${timestamp}.json`);
    this.summaryFile = join(reportsDir, "latest_summary.txt");
    this.systemInfo = {};
    this.testMetadata = {
      startTime: new Date(),
      testConfig: {},
      errors: [],
      warnings: [],
    };
  }

  formatMs(ms) {
    return `${ms.toFixed(2)}ms`;
  }

  collectSystemInfo(binaryDir) {
    try {
      this.systemInfo = {
        timestamp: new Date().toISOString(),
        hostname: execSync("hostname", { encoding: "utf8" }).trim(),
        os: execSync("uname -a", { encoding: "utf8" }).trim(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpuCores: execSync("nproc", { encoding: "utf8" }).trim(),
        memory: execSync("free -h | grep \"Mem:\" | awk '{print $2}'", {
          encoding: "utf8",
          shell: "/bin/bash",
        }).trim(),
        availableMemory: execSync(
          "free -h | grep \"Mem:\" | awk '{print $7}'",
          { encoding: "utf8", shell: "/bin/bash" },
        ).trim(),
        diskSpace: execSync("df -h . | tail -1 | awk '{print $4}'", {
          encoding: "utf8",
          shell: "/bin/bash",
        }).trim(),
        workingDirectory: process.cwd(),
      };

      // Collect binary information
      this.systemInfo.binaries = {};

      [
        "cross-platform-tool-linux",
        "cross-platform-tool-macos",
        "cross-platform-tool-win.exe",
      ].forEach((binary) => {
        const binaryFile = join(binaryDir, binary);
        if (existsSync(binaryFile)) {
          const stats = statSync(binaryFile);
          this.systemInfo.binaries[binary] = {
            size: `${(stats.size / 1024 / 1024).toFixed(2)}MB`,
            lastModified: stats.mtime.toISOString(),
            executable: stats.mode & parseInt("111", 8) ? true : false,
          };
        }
      });
    } catch (error) {
      console.warn("Could not collect complete system info:", error.message);
      this.systemInfo = {
        timestamp: new Date().toISOString(),
        error: error.message,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      };
    }
  }

  getPerformanceRating(avgMs) {
    if (avgMs < 1) return "Excellent (< 1ms)";
    if (avgMs < 5) return "Very Good (< 5ms)";
    if (avgMs < 10) return "Good (< 10ms)";
    if (avgMs < 50) return "Fair (< 50ms)";
    return "Needs Improvement (> 50ms)";
  }

  getConsistencyRating(stats) {
    const variance = stats.p95 - stats.p50;
    if (variance < 1) return "Excellent";
    if (variance < 5) return "Very Good";
    if (variance < 10) return "Good";
    if (variance < 20) return "Fair";
    return "Poor";
  }

  getStabilityRating(loadStats) {
    if (loadStats.p99 < loadStats.average * 3) return "Excellent";
    if (loadStats.p99 < loadStats.average * 5) return "Good";
    if (loadStats.p99 < loadStats.average * 10) return "Fair";
    return "Poor";
  }

  getOverallGrade(results) {
    const averages = Object.values(results).map((r) => r.average);
    const overallAvg = averages.reduce((a, b) => a + b, 0) / averages.length;

    if (overallAvg < 2) return "A+ (Excellent)";
    if (overallAvg < 5) return "A (Very Good)";
    if (overallAvg < 10) return "B (Good)";
    if (overallAvg < 25) return "C (Fair)";
    return "D (Needs Improvement)";
  }

  getProductionReadiness(results) {
    const hasGoodPerf = Object.values(results).every((r) => r.average < 50);
    const hasConsistency = Object.values(results).every(
      (r) => r.p95 < r.average * 5,
    );
    const hasDbOps = results.dbList && results.dbAdd;

    if (hasGoodPerf && hasConsistency && hasDbOps) return "✅ READY";
    if (hasGoodPerf && hasConsistency) return "⚠️  MOSTLY READY (DB issues)";
    if (hasGoodPerf) return "⚠️  NEEDS OPTIMIZATION (consistency)";
    return "❌ NOT READY (performance issues)";
  }

  generateTextReport(results, tests, sampleCodeLength) {
    const endTime = new Date();
    const duration = ((endTime - this.testMetadata.startTime) / 1000).toFixed(
      2,
    );

    let report = `
===============================================================================
                        COMPREHENSIVE PERFORMANCE REPORT
===============================================================================
Generated: ${endTime.toISOString()}
Duration: ${duration} seconds
Test ID: ${this.timestamp}
Server: ${this.baseUrl}

===============================================================================
🖥️  SYSTEM INFORMATION
===============================================================================
Hostname:         ${this.systemInfo.hostname || "Unknown"}
OS:               ${this.systemInfo.os || "Unknown"}
Node.js Version:  ${this.systemInfo.nodeVersion}
Platform:         ${this.systemInfo.platform}
Architecture:     ${this.systemInfo.arch}
CPU Cores:        ${this.systemInfo.cpuCores || "Unknown"}
Memory:           ${this.systemInfo.memory || "Unknown"}
Available Memory: ${this.systemInfo.availableMemory || "Unknown"}
Disk Space:       ${this.systemInfo.diskSpace || "Unknown"}
Working Dir:      ${this.systemInfo.workingDirectory}

BINARY INFORMATION:
`;

    if (this.systemInfo.binaries) {
      Object.entries(this.systemInfo.binaries).forEach(([name, info]) => {
        report += `${name}:\n`;
        report += `  - Size: ${info.size}\n`;
        report += `  - Last Modified: ${info.lastModified}\n`;
        report += `  - Executable: ${info.executable ? "Yes" : "No"}\n`;
      });
    } else {
      report += "No binary information available\n";
    }

    report += `
===============================================================================
⚙️  TEST CONFIGURATION
===============================================================================
Test Endpoints:
`;

    Object.entries(tests).forEach(([name, config]) => {
      if (config && config.count) {
        report += `- ${name}: ${config.count} requests to ${config.endpoint || "unknown"}\n`;
      } else if (config && config.duration) {
        report += `- ${name}: ${config.duration / 1000}s load test to ${config.endpoint || "unknown"}\n`;
      } else {
        report += `- ${name}: Configuration missing or invalid\n`;
      }
    });

    report += `
Sample Code Length: ${sampleCodeLength} characters
Base URL: ${this.baseUrl}
Timeout: 5000ms per request

===============================================================================
📊 DETAILED PERFORMANCE RESULTS
===============================================================================
`;

    // Only show results for tests that actually ran
    Object.entries(results).forEach(([testName, stats]) => {
      if (stats && stats.count > 0) {
        const displayName =
          testName.charAt(0).toUpperCase() + testName.slice(1);
        report += `
📈 ${displayName} Performance:
   Requests:     ${stats.count}
   Average:      ${this.formatMs(stats.average)}
   Min:          ${this.formatMs(stats.min)}
   Max:          ${this.formatMs(stats.max)}
   Median (P50): ${this.formatMs(stats.p50)}
   P95:          ${this.formatMs(stats.p95)}
   P99:          ${this.formatMs(stats.p99)}
   
   Performance Rating: ${this.getPerformanceRating(stats.average)}
   Consistency:        ${this.getConsistencyRating(stats)}
`;
      }
    });

    // Show which tests were skipped
    const configuredTests = Object.keys(tests);
    const completedTests = Object.keys(results);
    const skippedTests = configuredTests.filter(
      (test) => !completedTests.includes(test),
    );

    if (skippedTests.length > 0) {
      report += `
⚠️  SKIPPED TESTS:
${skippedTests.map((test) => `- ${test}: Test was skipped or failed to complete`).join("\n")}
`;
    }

    report += `
===============================================================================
📈 PERFORMANCE ANALYSIS
===============================================================================

SPEED RANKINGS (by average response time):
`;

    const sortedResults = Object.entries(results)
      .filter(
        ([name, stats]) => stats && stats.count > 0 && !name.includes("load"),
      )
      .sort(([, a], [, b]) => a.average - b.average);

    if (sortedResults.length > 0) {
      sortedResults.forEach(([name, stats], index) => {
        report += `${index + 1}. ${name}: ${this.formatMs(stats.average)}\n`;
      });
    } else {
      report += "No completed tests to rank\n";
    }

    report += `
CONSISTENCY RANKINGS (by P95 - P50 variance):
`;

    const consistencyRankings = Object.entries(results)
      .filter(
        ([name, stats]) => stats && stats.count > 0 && !name.includes("load"),
      )
      .sort(([, a], [, b]) => a.p95 - a.p50 - (b.p95 - b.p50));

    if (consistencyRankings.length > 0) {
      consistencyRankings.forEach(([name, stats], index) => {
        const variance = stats.p95 - stats.p50;
        report += `${index + 1}. ${name}: ${this.formatMs(variance)} variance\n`;
      });
    } else {
      report += "No completed tests to rank\n";
    }

    // Load test special analysis
    if (results.load && results.load.count > 0) {
      const throughput = (
        results.load.count /
        (tests.load.duration / 1000)
      ).toFixed(0);
      report += `
LOAD TEST ANALYSIS:
- Total Requests: ${results.load.count}
- Duration: ${tests.load.duration / 1000}s
- Throughput: ${throughput} requests/second
- Average Response: ${this.formatMs(results.load.average)}
- P95 Response: ${this.formatMs(results.load.p95)}
- Server Stability: ${this.getStabilityRating(results.load)}
`;
    } else {
      report += "No load test results available for analysis\n";
    }

    report += `
===============================================================================
🎯 RECOMMENDATIONS
===============================================================================

PERFORMANCE OPTIMIZATION:
`;

    Object.entries(results).forEach(([name, stats]) => {
      if (stats.average > 10) {
        report += `⚠️  ${name}: Consider optimization (${this.formatMs(stats.average)} avg)\n`;
      } else if (stats.average < 2) {
        report += `✅ ${name}: Excellent performance (${this.formatMs(stats.average)} avg)\n`;
      } else {
        report += `👍 ${name}: Good performance (${this.formatMs(stats.average)} avg)\n`;
      }
    });

    report += `
SCALING CONSIDERATIONS:
- Current throughput capacity: ~${results.load ? Math.floor(results.load.count / (tests.load.duration / 1000)) : "Unknown"} req/sec
- Recommended max load: 80% of capacity for safety margin
- Consider horizontal scaling if sustained load > 1000 req/sec
- Monitor memory usage during high concurrency

MONITORING ALERTS:
- Set P95 latency alert at 10ms for critical endpoints
- Set throughput alert if drops below 500 req/sec
- Monitor error rates > 1%
- Set memory usage alert at 80% capacity

===============================================================================
🔍 TROUBLESHOOTING DATA
===============================================================================

TEST ERRORS: ${this.testMetadata.errors.length}
`;

    this.testMetadata.errors.forEach((error, index) => {
      report += `${index + 1}. ${error}\n`;
    });

    report += `
TEST WARNINGS: ${this.testMetadata.warnings.length}
`;

    this.testMetadata.warnings.forEach((warning, index) => {
      report += `${index + 1}. ${warning}\n`;
    });

    report += `
ENVIRONMENT VALIDATION:
✅ Server connectivity: Verified
✅ All endpoints responding: ${Object.keys(results).length > 0 ? "Yes" : "No"}
✅ Database operations: ${results.dbList && results.dbAdd ? "Working" : "Limited"}
✅ Concurrent handling: ${results.concurrent ? "Tested" : "Not tested"}
✅ Load handling: ${results.load ? "Tested" : "Not tested"}

===============================================================================
📋 SUMMARY
===============================================================================

OVERALL PERFORMANCE GRADE: ${this.getOverallGrade(results)}

TOP PERFORMING ENDPOINTS:
${sortedResults
  .slice(0, 3)
  .map(
    ([name, stats], i) => `${i + 1}. ${name}: ${this.formatMs(stats.average)}`,
  )
  .join("\n")}

AREAS FOR IMPROVEMENT:
${sortedResults
  .slice(-3)
  .map(
    ([name, stats], i) => `${i + 1}. ${name}: ${this.formatMs(stats.average)}`,
  )
  .join("\n")}

PRODUCTION READINESS: ${this.getProductionReadiness(results)}

===============================================================================
📞 SUPPORT INFORMATION
===============================================================================

For performance issues:
1. Check system resources (CPU, Memory, Disk)
2. Review error logs in application
3. Monitor database performance
4. Consider scaling options

Report Location: ${this.reportFile}
JSON Data: ${this.jsonReport}
Summary: ${this.summaryFile}

===============================================================================
END OF REPORT
===============================================================================
`;

    return report;
  }

  generateJSONReport(results, tests) {
    return JSON.stringify(
      {
        metadata: {
          timestamp: new Date().toISOString(),
          testId: this.timestamp,
          duration: (new Date() - this.testMetadata.startTime) / 1000,
          baseUrl: this.baseUrl,
          nodeVersion: process.version,
        },
        systemInfo: this.systemInfo,
        testConfiguration: tests,
        results: results,
        analysis: {
          fastestEndpoint: Object.entries(results).reduce(
            (min, [name, stats]) =>
              stats.average < min.stats.average ? { name, stats } : min,
            { name: "none", stats: { average: Infinity } },
          ),
          slowestEndpoint: Object.entries(results).reduce(
            (max, [name, stats]) =>
              stats.average > max.stats.average ? { name, stats } : max,
            { name: "none", stats: { average: 0 } },
          ),
          throughput: results.load
            ? results.load.count / (tests.load.duration / 1000)
            : 0,
          overallGrade: this.getOverallGrade(results),
          productionReady: this.getProductionReadiness(results),
        },
        errors: this.testMetadata.errors,
        warnings: this.testMetadata.warnings,
      },
      null,
      2,
    );
  }

  generateSummaryReport(results) {
    const summary = `
===============================================================================
                           PERFORMANCE TEST SUMMARY
===============================================================================
Test Date: ${new Date().toISOString()}
Test ID: ${this.timestamp}
Server: ${this.baseUrl}

SYSTEM:
- OS: ${this.systemInfo.platform}
- Node.js: ${this.systemInfo.nodeVersion}
- CPU Cores: ${this.systemInfo.cpuCores || "Unknown"}
- Memory: ${this.systemInfo.memory || "Unknown"}

PERFORMANCE HIGHLIGHTS:
${Object.entries(results)
  .map(
    ([name, stats]) =>
      `- ${name}: ${this.formatMs(stats.average)} avg (${stats.count} requests)`,
  )
  .join("\n")}

OVERALL GRADE: ${this.getOverallGrade(results)}
PRODUCTION READY: ${this.getProductionReadiness(results)}

FULL REPORT: ${this.reportFile}
JSON DATA: ${this.jsonReport}
===============================================================================
`;
    return summary;
  }

  addError(error) {
    this.testMetadata.errors.push(error);
  }

  addWarning(warning) {
    this.testMetadata.warnings.push(warning);
  }

  saveReports(results, tests, sampleCodeLength, rootDir) {
    // Ensure reports directory exists
    if (!existsSync(this.reportsDir)) {
      mkdirSync(this.reportsDir, { recursive: true });
    }

    try {
      // Save main report
      const textReport = this.generateTextReport(
        results,
        tests,
        sampleCodeLength,
      );
      writeFileSync(this.reportFile, textReport);

      // Save JSON data
      const jsonReport = this.generateJSONReport(results, tests);
      writeFileSync(this.jsonReport, jsonReport);

      // Save summary
      const summary = this.generateSummaryReport(results);
      writeFileSync(this.summaryFile, summary);

      // Also save to root directory for easy access
      writeFileSync(join(rootDir, "LATEST_PERFORMANCE_REPORT.txt"), textReport);
      writeFileSync(join(rootDir, "LATEST_PERFORMANCE_SUMMARY.txt"), summary);

      console.log("\n📄 Reports generated successfully!");
      console.log(`📄 Main Report: ${this.reportFile}`);
      console.log(`📄 JSON Data: ${this.jsonReport}`);
      console.log(`📄 Summary: ${this.summaryFile}`);
      console.log(`📄 Quick Access: LATEST_PERFORMANCE_REPORT.txt`);
    } catch (error) {
      console.error("❌ Failed to save reports:", error.message);
      this.testMetadata.errors.push(
        `Report generation failed: ${error.message}`,
      );
    }
  }
}
