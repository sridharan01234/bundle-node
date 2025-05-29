// Test JavaScript file for analysis
const fs = require("fs");
const path = require("path");

function calculateSum(a, b) {
  if (a < 0 || b < 0) {
    throw new Error("Negative numbers not allowed");
  }
  return a + b;
}

class Calculator {
  constructor() {
    console.log("Calculator initialized");
    // TODO: Initialize history
    this.history = [];
  }

  add(a, b) {
    const result = calculateSum(a, b);
    this.history.push({ operation: "add", a, b, result });
    return result;
  }
}

const calc = new Calculator();
let result = calc.add(5, 3);
console.log(result);
