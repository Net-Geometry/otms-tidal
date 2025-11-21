import { Parser } from 'expr-eval';

export interface FormulaValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface FormulaEvaluationResult {
  orp: number;
  hrp: number;
  otAmount: number;
  breakdown: string;
}

const ALLOWED_VARIABLES = ['Hours', 'ORP', 'HRP', 'Basic'];
const ALLOWED_FUNCTIONS = ['IF', 'MIN', 'MAX', 'ROUND'];

export function validateFormulaSyntax(formula: string): FormulaValidationResult {
  const errors: string[] = [];

  if (!formula || formula.trim() === '') {
    return { isValid: false, errors: ['Formula cannot be empty'] };
  }

  // Check for balanced parentheses
  let parenCount = 0;
  for (const char of formula) {
    if (char === '(') parenCount++;
    if (char === ')') parenCount--;
    if (parenCount < 0) {
      errors.push('Unbalanced parentheses: closing bracket without opening');
      break;
    }
  }
  if (parenCount > 0) {
    errors.push('Unbalanced parentheses: missing closing bracket(s)');
  }

  // Check for valid variable names
  const variablePattern = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
  const matches = formula.match(variablePattern) || [];
  const invalidVars = matches.filter(
    v => !ALLOWED_VARIABLES.includes(v) && !ALLOWED_FUNCTIONS.includes(v) && v !== 'IF'
  );
  if (invalidVars.length > 0) {
    errors.push(`Unknown variables or functions: ${[...new Set(invalidVars)].join(', ')}`);
  }

  // Check IF statement syntax
  const ifPattern = /IF\s*\(/gi;
  const ifMatches = formula.match(ifPattern) || [];
  if (ifMatches.length > 0) {
    // Basic check: each IF should have at least 2 commas for 3 arguments
    const ifBlocks = extractIFBlocks(formula);
    for (const block of ifBlocks) {
      const commaCount = countTopLevelCommas(block);
      if (commaCount !== 2) {
        errors.push(`IF statement requires exactly 3 arguments (condition, true_value, false_value)`);
        break;
      }
    }
  }

  // Try to parse with expr-eval
  try {
    const parser = new Parser();
    // Convert IF() to ternary for parsing
    const testFormula = convertIFToTernary(formula);
    parser.parse(testFormula);
  } catch (e: any) {
    errors.push(`Syntax error: ${e.message}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function evaluateFormula(
  formula: string,
  basicSalary: number,
  hours: number,
  multiplier?: number
): FormulaEvaluationResult {
  const orp = basicSalary / 26;
  const hrp = orp / 8;

  try {
    const parser = new Parser();
    // Convert IF() to ternary for evaluation
    const evaluableFormula = convertIFToTernary(formula);
    const expr = parser.parse(evaluableFormula);
    const otAmount = expr.evaluate({
      Hours: hours,
      ORP: orp,
      HRP: hrp,
      Basic: basicSalary,
    });

    // Apply multiplier if provided
    const baseFormulaResult = otAmount;
    const finalOTAmount = multiplier ? baseFormulaResult * multiplier : baseFormulaResult;
    
    let breakdown = `Basic: RM ${basicSalary.toFixed(2)}\nORP: RM ${orp.toFixed(2)}\nHRP: RM ${hrp.toFixed(2)}\nHours: ${hours}`;
    
    if (multiplier) {
      breakdown += `\nFinal OT Amount: RM ${finalOTAmount.toFixed(2)}`;
    } else {
      breakdown += `\nOT Amount: RM ${finalOTAmount.toFixed(2)}`;
    }

    return {
      orp,
      hrp,
      otAmount: finalOTAmount,
      breakdown,
    };
  } catch (e: any) {
    throw new Error(`Evaluation error: ${e.message}`);
  }
}

function extractIFBlocks(formula: string): string[] {
  const blocks: string[] = [];
  let i = 0;
  while (i < formula.length) {
    if (formula.substring(i, i + 2).toUpperCase() === 'IF' && formula[i + 2] === '(') {
      let depth = 0;
      let start = i + 2;
      for (let j = start; j < formula.length; j++) {
        if (formula[j] === '(') depth++;
        if (formula[j] === ')') {
          depth--;
          if (depth === 0) {
            blocks.push(formula.substring(start + 1, j));
            i = j + 1;
            break;
          }
        }
      }
    } else {
      i++;
    }
  }
  return blocks;
}

function countTopLevelCommas(str: string): number {
  let count = 0;
  let depth = 0;
  for (const char of str) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) count++;
  }
  return count;
}

function convertIFToTernary(formula: string): string {
  // Convert IF(condition, trueVal, falseVal) to (condition ? trueVal : falseVal)
  // Process from innermost to outermost for nested IFs
  let result = formula;
  let hasChanges = true;
  let maxIterations = 20; // Increased for deeply nested IFs
  
  // Keep converting innermost IFs until none remain
  while (hasChanges && maxIterations-- > 0) {
    hasChanges = false;
    
    // Find IF statements from the end (innermost first)
    for (let i = result.length - 1; i >= 0; i--) {
      if (result.substring(i, i + 2).toUpperCase() === 'IF' && 
          result[i + 2] === '(' && 
          (i === 0 || !/[A-Za-z0-9_]/.test(result[i - 1]))) {
        
        // Find matching closing parenthesis using depth tracking
        let depth = 0;
        let start = i + 2;
        let end = -1;
        
        for (let j = start; j < result.length; j++) {
          if (result[j] === '(') depth++;
          if (result[j] === ')') {
            depth--;
            if (depth === 0) {
              end = j;
              break;
            }
          }
        }
        
        if (end !== -1) {
          const argsStr = result.substring(start + 1, end);
          const args = splitIFArguments(argsStr);
          
          if (args.length === 3) {
            const ternary = `(${args[0]} ? ${args[1]} : ${args[2]})`;
            result = result.substring(0, i) + ternary + result.substring(end + 1);
            hasChanges = true;
            break; // Restart from the beginning after each conversion
          }
        }
      }
    }
  }
  
  return result;
}

function splitIFArguments(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  
  for (const char of argsStr) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current) {
    args.push(current.trim());
  }
  
  return args;
}
