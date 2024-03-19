const SYSTEM_TOKEN = "<|system|>";
const USER_TOKEN = "<|user|>";
const ASSISTANT_TOKEN = "<|assistant|>";
const END_OF_STRING = "</s>";
const DEFAULT_SYSTEM_PROMPT = "As a friendly chatbot, you're assisting a researcher in conducting a research interview. Your role is to engage with the participant by responding with relevant questions based on their previous replies, ensuring a smooth and natural flow of conversation.";

export function apply_chat_template(
  chat: { question: string; response: string }[],
  research_purpose: string,
) {
  let output =
    `${SYSTEM_TOKEN} ${research_purpose}\n${DEFAULT_SYSTEM_PROMPT}${END_OF_STRING}\n${USER_TOKEN}\nStart asking me questions${END_OF_STRING}\n`;
  for (let index = 0; index < chat.length; index++) {
    const element = chat[index];
    output = output.concat(
      `${ASSISTANT_TOKEN}\n${element.question}${END_OF_STRING}\n`,
      `${USER_TOKEN}\n${element.response}${END_OF_STRING}\n`,
    );
  }
  output = output.concat(ASSISTANT_TOKEN);
  return output;
}
