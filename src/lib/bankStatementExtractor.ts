const API_KEY_STORAGE_KEY = 'otms_ai_api_key';
const MODEL_STORAGE_KEY = 'otms_ai_model';

export const AI_MODELS = [
  { value: 'anthropic/claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (recommended)' },
  { value: 'anthropic/claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (cheaper)' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (budget)' },
] as const;

export const DEFAULT_MODEL = AI_MODELS[0].value;

export interface ExtractedTransaction {
  date: string;          // YYYY-MM-DD
  description: string;
  reference: string;     // cheque no, ref no, etc.
  debit: number;         // withdrawal/payment
  credit: number;        // deposit/receipt
  balance: number;       // running balance (0 if not available)
}

export interface ExtractionResult {
  transactions: ExtractedTransaction[];
  statementDate: string;
  closingBalance: number;
  bankName: string;
  accountNumber: string;
}

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function getSelectedModel(): string {
  return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const EXTRACTION_PROMPT = `Extract all transactions from this bank statement. Return a JSON object with this exact structure:

{
  "bankName": "string - name of the bank",
  "accountNumber": "string - account number shown on statement",
  "statementDate": "YYYY-MM-DD - statement end date",
  "closingBalance": number,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "string - transaction description",
      "reference": "string - cheque/ref number or empty string",
      "debit": number (withdrawal amount, 0 if credit),
      "credit": number (deposit amount, 0 if debit),
      "balance": number (running balance, 0 if not shown)
    }
  ]
}

Rules:
- Return ONLY the JSON object, no markdown, no explanation
- Use 0 for missing numeric values
- Parse dates in the statement to YYYY-MM-DD format
- Include ALL transactions, do not skip any
- debit = money going OUT (withdrawals, payments, charges)
- credit = money coming IN (deposits, transfers in)`;

export async function extractBankStatement(
  file: File,
  onProgress?: (message: string) => void,
): Promise<ExtractionResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API key not configured. Go to Settings to add your OpenRouter key.');
  }

  onProgress?.('Converting PDF to base64...');
  const base64Data = await fileToBase64(file);
  const dataUrl = `data:application/pdf;base64,${base64Data}`;

  const model = getSelectedModel();
  onProgress?.(`Sending to ${model.split('/')[1]} for extraction...`);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: dataUrl },
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = (error as any)?.error?.message || `API error: ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI model');
  }

  onProgress?.('Parsing extracted data...');

  // Parse the JSON response - handle potential markdown wrapping
  let jsonText = content.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(jsonText) as ExtractionResult;

  if (!Array.isArray(parsed.transactions)) {
    throw new Error('Invalid extraction result: no transactions array');
  }

  parsed.transactions = parsed.transactions.map((t) => ({
    date: t.date || '',
    description: t.description || '',
    reference: t.reference || '',
    debit: Number(t.debit || 0),
    credit: Number(t.credit || 0),
    balance: Number(t.balance || 0),
  }));

  return parsed;
}
