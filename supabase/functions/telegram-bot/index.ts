import { Bot, Context, enhanceStorage, session, SessionFlavor, webhookCallback } from "https://deno.land/x/grammy@v1.21.1/mod.ts";
import { type Conversation, type ConversationFlavor, conversations, createConversation } from "https://deno.land/x/grammy_conversations@v1.2.0/mod.ts";
import { EmojiFlavor, emojiParser } from "https://deno.land/x/grammy_emoji@v1.2.0/mod.ts";
import { apiThrottler } from "https://deno.land/x/grammy_transformer_throttler@v1.2.1/mod.ts";
import { supabaseAdapter } from "https://deno.land/x/grammy_storages/supabase/src/mod.ts";
import { supabase } from "./supabase-client.ts";
import { apply_chat_template } from "./chat-templater.ts";
import { ai_askqn } from "./ai-functions.ts";
import { createSummary } from "./utils.ts";

interface SessionData {
  count: number;
}
type MyContext =
  & Context
  & SessionFlavor<SessionData>
  & ConversationFlavor;
type MyConversation = Conversation<MyContext>;

const bot = new Bot(Deno.env.get("TELEGRAM_BOT_TOKEN") || "");
const throttler = apiThrottler();
bot.api.config.use(throttler);
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
// bot.use(emojiParser());

async function research(
  conversation: MyConversation,
  ctx: MyContext,
) {
  await conversation.run(emojiParser());
  const id = ctx.match;
  conversation.session.chat_log = [];
  try {
    const { data, error } = await conversation.external(() =>
      supabase.from("projects").select(
        "id, name, description, questions, contact",
      )
        .eq("id", id)
    );
    if (error) throw error;
    const questions = JSON.parse(data[0].questions);

    await ctx
      .replyWithEmoji`Hey there! ${"smiling_face_with_open_hands"}\nThank you for participating in this study. I'll be asking you about ${
      questions.length * 2
    } short questions. Answer them to the best of your ability!`;

    for (let index = 0; index < questions.length; index++) {
      await ctx.reply(questions[index]);
      const { message } = await conversation.wait();
      conversation.session.chat_log.push({
        question: questions[index],
        response: message.text,
      });

      // AI prompt question
      const { aiQuestion, isQuestion } = await conversation.external(() =>
        ai_askqn(
          apply_chat_template(
            conversation.session.chat_log,
            data[0].description,
          ),
        )
      );
      if (isQuestion) {
        await ctx.reply(aiQuestion);
        const { message: aiResponse } = await conversation.wait();
        conversation.session.chat_log.push({
          question: aiQuestion,
          response: aiResponse.text,
        });
      } else if (aiQuestion.length > 0) {
        await ctx.reply(aiQuestion);
        conversation.session.chat_log.push({
          question: aiQuestion,
          response: "",
        });
      }
    }

    // Feedback question
    await ctx
      .replyWithEmoji`Thank you for your time! ${"grinning_face_with_big_eyes"}\nHow would rate this conversation?`;
    const { message } = await conversation.wait();
    conversation.session.chat_log.push({
      question: "Conversation Feedback",
      response: message.text,
    });

    // Save user metadata
    conversation.session.user_metadata = message.from;

    await conversation.external(() =>
      supabase.from("responses").insert({
        project_id: id,
        log: JSON.stringify({
          user_metadata: conversation.session.user_metadata,
          chat_log: conversation.session.chat_log,
        }),
      })
    );

    await conversation.log(`Conversation ${ctx.msg.chat.id} ended and saved.`);
    await ctx
      .replyWithEmoji`Thank you so much for your feedback! We've come to the end of the study ${"thumbs_up"}`;

    // Send summary to client
    const summary = createSummary(
      conversation.session.chat_log,
      conversation.session.user_metadata.username,
      data[0].name,
    );
    await bot.api.sendMessage(data[0].contact, summary, { parse_mode: "HTML" });
  } catch (error) {
    await conversation.error(error);
    await ctx.reply(`An error occurred. Could not fetch questions for ${id}`);
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
      await ctx.reply("Hey there!");
    }
  },
);

bot.command("subscribe", async (ctx: MyContext) => {
  if (ctx.match) {
    try {
      await supabase.from("projects").update({ contact: ctx.msg.chat.id }).eq(
        "id",
        ctx.match,
      );
      await ctx.reply(
        "Congrats you are now subscribed. You will receive an update whenever someone completes your study.",
      );
    } catch (error) {
      console.error(error);
      await ctx.reply("Please provide valid name");
    }
  }
});

bot.command("ping", async (ctx: MyContext) => {
  await ctx.reply(`Pong! ${new Date()} ${Date.now()}`);
});

const handleUpdate = webhookCallback(bot, "std/http");

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("secret") !== Deno.env.get("FUNCTION_SECRET")) {
      return new Response("not allowed", { status: 405 });
    }
    console.log(req.headers);
    return await handleUpdate(req);
  } catch (err) {
    console.error(err);
  }
  return new Response();
});
