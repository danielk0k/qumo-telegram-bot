import {
  Bot,
  Context,
  enhanceStorage,
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
import {
  EmojiFlavor,
  emojiParser,
} from "https://deno.land/x/grammy_emoji@v1.2.0/mod.ts";
import { supabaseAdapter } from "https://deno.land/x/grammy_storages/supabase/src/mod.ts";
import { supabase } from "./supabase-client.ts";
import { apply_chat_template } from "./chat-templater.ts";
import { ai_askqn } from "./ai-functions.ts";

interface SessionData {
  count: number;
}
type MyContext =
  & EmojiFlavor<Context>
  & SessionFlavor<SessionData>
  & ConversationFlavor;
type MyConversation = Conversation<MyContext>;

const bot = new Bot(Deno.env.get("TELEGRAM_BOT_TOKEN") || "");

bot.use(
  session({
    initial: () => ({ user_metadata: {}, chat_log: [] }),
    storage: enhanceStorage({
      storage: supabaseAdapter({
        supabase,
        table: "session",
      }),
      millisecondsToLive: 5 * 60 * 1000, // 5 min
    }),
  }),
);

bot.use(conversations());
bot.use(emojiParser());

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

    await ctx.replyWithEmoji`Hey there! ${"smiling_face_with_open_hands"}\nThank you for participating in this study. I'll be asking you about ${questions.length * 2} short questions. Answer them to the best of your ability ${"thumbs_up"}`;

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
          "inputs": apply_chat_template(
            responses,
            data[0].description,
          ),
        })
      );
      ctx.reply(ai_question);
      const { message: followup_reply } = await conversation.wait();
      responses.push({
        question: ai_question,
        response: followup_reply.text,
      });
    }

    // Feedback Question
    ctx.replyWithEmoji`Thank you for your time! ${"grinning_face_with_big_eyes"}\nHow would rate this conversation?`;
    const { message } = await conversation.wait();
    responses.push({
      question: "Conversation Feedback",
      response: message.text,
    });

    // Save session
    ctx.session.chat_log = responses;
    ctx.session.user_metadata = message.from;

    await conversation.external(() =>
      supabase.from("responses").insert({
        project_id: id,
        log: JSON.stringify(ctx.session),
      })
    );

    await conversation.log(`Conversation ${ctx.msg.chat.id} ended and saved.`);
    ctx.replyWithEmoji`Thank you so much for your feedback! We've come to the end of the study ${"star_struck"}`;
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
      await ctx.conversation.enter("research");
    } else {
      ctx.reply("Hey there!");
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
