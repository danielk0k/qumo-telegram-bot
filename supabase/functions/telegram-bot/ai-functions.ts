import { extract_response } from "./chat-templater.ts";

export async function ai_askqn(data) {
  const response = await fetch(
    "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta",
    {
      headers: {
        Authorization: `Bearer ${Deno.env.get("HF_TOKEN") || ""}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify(data),
    },
  );
  const result = await response.json();
  return extract_response(result[0].generated_text);
}
