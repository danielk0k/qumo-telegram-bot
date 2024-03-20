import { HfInference } from "https://esm.sh/@huggingface/inference@2.3.2";
import { removeIncompleteSentence } from "./utils.ts";

const hf = new HfInference(Deno.env.get("HF_TOKEN"));

export async function ai_askqn(data: string) {
  const text = await hf.textGeneration(
    {
      inputs: data,
      model: "HuggingFaceH4/zephyr-7b-beta",
      parameters: {
        max_new_tokens: 32,
        max_time: 16.0,
        return_full_text: false,
      },
    },
    {
      use_cache: false,
    },
  );
  return removeIncompleteSentence(text.generated_text);
}
