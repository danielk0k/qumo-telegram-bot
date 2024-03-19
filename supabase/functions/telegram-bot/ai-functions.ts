import { removeIncompleteSentence } from "./utils.ts";

export async function ai_askqn(data) {
  const response = await fetch(
    "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta",
    {
      headers: {
        Authorization: `Bearer ${Deno.env.get("HF_TOKEN") || ""}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        ...data,
        "parameters": {
          "max_new_tokens": 32,
          "max_time": 16.0,
          "return_full_text": false,
        },
      }),
    },
  );
  const result = await response.json();
  return removeIncompleteSentence(result[0].generated_text);
}
