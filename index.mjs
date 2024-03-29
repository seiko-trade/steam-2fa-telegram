import "dotenv/config";
import SteamTotp from "steam-totp";
import sqlite3 from "sqlite3";
import { Telegraf } from "telegraf";

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("BOT_TOKEN is not provided");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const db = new sqlite3.Database("./database.db");

await new Promise((resolve, reject) => {
  db.run(
    `
CREATE TABLE IF NOT EXISTS accounts (
	id int PRIMARY KEY,
  account_name text,
  steam_code text,
  message_id int,
  tg_id int
)`,
    (res, err) => {
      if (err) return reject(err);
      resolve(res);
    }
  );
});

/**
 * @type {Array<{steam_code: string, tg_id: number, account_name: string, message_id: string}>}
 */
const accounts = await new Promise((resolve, reject) => {
  db.all("SELECT * FROM accounts", (err, rows) => {
    if (err) return reject(err);
    resolve(rows);
  });
});

/**
 * @param {string} account_name
 * @param {string} code
 */
const formatMessage = (account_name, code) => {
  return `\`${account_name}\`

\`\`\`${code}\`\`\`

Last updated: ${new Date().toLocaleTimeString("en-US")}`;
};

bot.command("start", async (ctx) => {
  await ctx.reply("Hello, I'm a steam code bot");
  await ctx.reply(`Usage: /code "<account_name>" "<token>"`);
});

bot.command("code", async (ctx) => {
  if (ctx.args.length < 2) {
    return ctx.reply(`Usage: /code "<account_name>" "<token>"`);
  }
  const name = ctx.args[0];
  if (!name) {
    return ctx.reply("Please provide account name");
  }
  const token = ctx.args[1];
  if (!token) {
    return ctx.reply("Please provide token");
  }

  const tokenExists = accounts.find(
    (account) => account.steam_code === token && account.tg_id === ctx.from.id
  );
  if (tokenExists) {
    const notification = await ctx.reply("Token already exists");
    return setTimeout(() => {
      ctx.deleteMessage(ctx.message.message_id);
      ctx.deleteMessage(notification.message_id);
    }, 1000 * 5);
  }

  const totp = SteamTotp.getAuthCode(token);
  const notification = await ctx.reply(formatMessage(name, totp), {
    parse_mode: "MarkdownV2",
  });
  await new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO accounts (account_name, steam_code, tg_id, message_id) VALUES (?, ?, ?, ?)",
      [name, token, ctx.from.id, notification.message_id],
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
  ctx.deleteMessage(ctx.message.message_id);
  accounts.push({
    account_name: name,
    steam_code: token,
    tg_id: ctx.from.id,
    message_id: notification.message_id,
  });
});

async function issueCodeUpdates() {
  console.log("Issuing code updates");
  for (const account of accounts) {
    const totp = SteamTotp.getAuthCode(account.steam_code);
    await bot.telegram.editMessageText(
      account.tg_id,
      account.message_id,
      undefined,
      formatMessage(account.account_name, totp),
      {
        parse_mode: "MarkdownV2",
      }
    );
  }
}

issueCodeUpdates();
setInterval(async () => {
  await issueCodeUpdates();
}, 1000 * 10);

bot.launch();
