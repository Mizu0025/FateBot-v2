"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Add this at the top to declare the module for TypeScript
// @ts-ignore: No type definitions for 'irc-framework'
const irc_framework_1 = __importDefault(require("irc-framework"));
const server = 'hayate';
const channel = '#nanobot';
const nick = 'FateBotTS';
const triggerWord = 'fatebot'; // Example trigger word
const bot = new irc_framework_1.default.Client();
bot.connect({
    host: server,
    port: 6667, // Default IRC port
    nick: nick,
});
bot.on('registered', () => {
    bot.join(channel);
});
bot.on('join', (event) => {
    if (event.nick === nick && event.channel === channel) {
        bot.say(channel, 'FateBotTS has joined the channel!');
    }
});
bot.on('message', (event) => {
    if (event.target === channel && event.message.toLowerCase().includes(triggerWord)) {
        bot.say(channel, `You mentioned the trigger word '${triggerWord}'!`);
    }
});
