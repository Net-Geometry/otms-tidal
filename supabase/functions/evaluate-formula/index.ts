const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const { formula, basicSalary, hours, dayType } = await req.json();
    console.log('Evaluating formula:', {
      formula,
      basicSalary,
      hours,
      dayType
    });
    // Calculate base rates
    const orp = basicSalary / 26;
    const hrp = orp / 8;
    // Evaluate formula safely
    const otAmount = evaluateFormulaSafe(formula, {
      Hours: hours,
      ORP: orp,
      HRP: hrp,
      Basic: basicSalary
    });
    console.log('Evaluation result:', {
      orp,
      hrp,
      otAmount
    });
    return new Response(JSON.stringify({
      success: true,
      orp,
      hrp,
      otAmount
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Formula evaluation error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
function evaluateFormulaSafe(formula, variables) {
  // Convert IF statements to JavaScript ternary operators
  let jsFormula = convertIFToTernary(formula);
  // Replace variable names with their values
  for (const [key, value] of Object.entries(variables)){
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    jsFormula = jsFormula.replace(regex, value.toString());
  }
  console.log('Converted formula:', jsFormula);
  // Validate: only allow numbers, operators, and parentheses
  if (!/^[\d\s+\-*/()?:.]+$/.test(jsFormula)) {
    throw new Error('Formula contains invalid characters after substitution');
  }
  // Evaluate using Function (safer than eval in this controlled context)
  try {
    const result = new Function(`return ${jsFormula}`)();
    if (typeof result !== 'number' || isNaN(result)) {
      throw new Error('Formula did not evaluate to a valid number');
    }
    return result;
  } catch (e) {
    throw new Error(`Formula evaluation failed: ${e.message}`);
  }
}
function convertIFToTernary(formula) {
  // Convert IF(condition, trueVal, falseVal) to (condition ? trueVal : falseVal)
  // Process from innermost to outermost for nested IFs
  let result = formula;
  let hasChanges = true;
  let maxIterations = 20; // Increased for deeply nested IFs
  // Keep converting innermost IFs until none remain
  while(hasChanges && maxIterations-- > 0){
    hasChanges = false;
    // Find IF statements from the end (innermost first)
    for(let i = result.length - 1; i >= 0; i--){
      if (result.substring(i, i + 2).toUpperCase() === 'IF' && result[i + 2] === '(' && (i === 0 || !/[A-Za-z0-9_]/.test(result[i - 1]))) {
        // Find matching closing parenthesis using depth tracking
        let depth = 0;
        let start = i + 2;
        let end = -1;
        for(let j = start; j < result.length; j++){
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
function splitIFArguments(argsStr) {
  const args = [];
  let current = '';
  let depth = 0;
  for (const char of argsStr){
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    args.push(current.trim());
  }
  return args;
}
