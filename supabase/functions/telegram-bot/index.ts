import { createClient } from "https://esm.sh/@supabase/supabase-js";
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

interface SessionData {
  count: number;
}
type MyContext = Context & SessionFlavor<SessionData> & ConversationFlavor;
type MyConversation = Conversation<MyContext>;

const bot = new Bot<MyContext>(Deno.env.get("TELEGRAM_BOT_TOKEN") || "");

bot.use(
  session({
    initial: () => ({ count: 0 }),
    storage: freeStorage<SessionData>(bot.token),
  }),
);
bot.use(conversations());
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? "",
);

async function study(
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
      responses.push({ question: questions[index], response: message });
    }
    ctx.reply("Thank you for your time!");
    await conversation.external(() =>
      supabase.from("responses").insert({
        project_id: id,
        log: JSON.stringify(responses),
      })
    );
    await conversation.log("Conversation ended and saved.");
  } catch (error) {
    await conversation.error(error);
    ctx.reply(`An error occurred. Could not fetch questions for ${id}`);
  }
  return;
}
bot.use(createConversation(study));

bot.command(
  "start",
  (ctx: MyContext) => ctx.reply("Welcome! Up and running."),
);

bot.command("ping", (ctx: MyContext) => {
  ctx.reply(`Pong! ${new Date()} ${Date.now()}`);
});

bot.command("register", async (ctx: MyContext) => {
  await ctx.conversation.enter("study");
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
