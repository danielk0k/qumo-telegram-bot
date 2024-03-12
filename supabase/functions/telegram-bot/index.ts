import {
  Bot,
  Context,
  session,
  SessionFlavor,
  webhookCallback,
} from "https://deno.land/x/grammy@v1.21.1/mod.ts";
import {
  type Conversation,
  type ConversationFlavor,
  conversations,
  createConversation,
} from "https://deno.land/x/grammy_conversations@v1.2.0/mod.ts";
import { freeStorage } from "https://deno.land/x/grammy_storages@v2.4.2/free/src/mod.ts";
import { supabase } from "./supabase-client.ts";
import { apply_chat_template } from "./chat-templater.ts";
import { ai_askqn } from "./ai-functions.ts";

interface SessionData {
  count: number;
}
type MyContext = Context & SessionFlavor<SessionData> & ConversationFlavor;
type MyConversation = Conversation<MyContext>;

const bot = new Bot(Deno.env.get("TELEGRAM_BOT_TOKEN") || "");

bot.use(
  session({
    initial: () => ({ count: 0 }),
    storage: freeStorage<SessionData>(bot.token),
  }),
);
bot.use(conversations());

async function research(
  conversation: MyConversation,
  ctx: MyContext,
) {
  const id = ctx.match;
  try {
    const { data, error } = await conversation.external(() =>
      supabase.from("projects").select(
        "id, name, description, questions",
      )
        .eq("id", id)
    );
    if (error) throw error;
    const questions = JSON.parse(data[0].questions);
    const responses: { question: string; response: string }[] = [];
    for (let index = 0; index < questions.length; index++) {
      ctx.reply(questions[index]);
      const { message } = await conversation.wait();
      responses.push({
        question: questions[index],
        response: message.text,
      });

      // Special AI Question
      const ai_question = await conversation.external(() =>
        ai_askqn({
          "inputs": apply_chat_template(responses, data[0].description),
        })
      );
      ctx.reply(ai_question);
      const { message: followup_reply } = await conversation.wait();
      responses.push({ question: ai_question, response: followup_reply.text });
    }

    // Feedback Question
    ctx.reply(
      "Thank you for your time! One last question, how would rate this conversation?",
    );
    const { message } = await conversation.wait();
    responses.push({
      question: "Conversation Feedback",
      response: message.text,
    });

    // Save conversation log
    responses.push({
      question: "Conversation Metadata",
      response: message.from,
    });
    await conversation.external(() =>
      supabase.from("responses").insert({
        project_id: id,
        log: JSON.stringify(responses),
      })
    );
    ctx.reply(
      "Thank you so much for your feedback! We've come to the end of the study. Have a great day :)",
    );
    await conversation.log(
      `Conversation with ${ctx.msg.chat.id} ended and saved.`,
    );
  } catch (error) {
    await conversation.error(error);
    ctx.reply(`An error occurred. Could not fetch questions for ${id}`);
  }
  return;
}
bot.use(createConversation(research));

bot.command(
  "start",
  async (ctx: MyContext) => {
    if (ctx.match) {
      ctx.reply(
        "Hey there, I'm Qumo! Thank you for participating in this study. Let's begin!",
      );
      await ctx.conversation.enter("research");
    } else {
      ctx.reply(
        "Hey there, I'm Qumo! To get started, type /start followed by a valid name.",
      );
    }
  },
);

bot.command("ping", (ctx: MyContext) => {
  ctx.reply(`Pong! ${new Date()} ${Date.now()}`);
});

const handleUpdate = webhookCallback(bot, "std/http");

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("secret") !== Deno.env.get("FUNCTION_SECRET")) {
      return new Response("not allowed", { status: 405 });
    }
    return await handleUpdate(req);
  } catch (err) {
    console.error(err);
  }
});
