'use strict';

const config = require('config');
const Discord = require('discord.js');
const moment = require('moment');
const storage = require('node-persist');
const request = require('request');
//const blueprintText = require('./lib/blueprintText'); 

let tmpStorage = {};
const bot = new Discord.Client();

function init() {
  bot.login(config.get('discord.token'));
  bot.on('ready', () => {
    log('Bot connected to Discord');
  });

  bot.on('disconnected', () => {
    bot.login(config.get('discord.token'));
  });

  bot.on('message', m => {
    newMessage(m.content, m.member, m);
  });
}

function log(...strs) {
  console.log(moment().format('LLL')+']',...strs);
}

function saveStorage() {
  this.storage.setItem(config.get('discord.server'), saveObj, (err) => {
    if (cb) cb(err);
  });
}

function newMessage(text, member, message) {
  log('['+member.id+'] #'+message.channel.name+'-'+member.username+': '+text);
  if (member.id == bot.id) return;
  const respond = (mention, str) => {
    message.channel.sendMessage(str ? mention+': '+str : mention).catch(e => console.log(e));
  }
  if (text == '!hey') {
    if (config.get('admins').indexOf(member.id) != -1) respond('\u0046\u0075\u0063\u006B\u0020\u0079\u006F\u0075, '+member);
    else respond('Hey, '+member+'!');
  } else if (text.indexOf('!mmo') == 0) {
    const cmd = text.slice(4, text.length).trim();
    if (!cmd) { respond(member, 'Try `!mmo on` or `!mmo off`'); return; }

    const role = message.channel.guild.roles.get(config.get('mmoid'));
    if (!role) { respond(member, 'There is no MMO guild!'); return; }

    if (cmd == 'on') {
      member.addRole(role).then(() => respond(member, 'You will now be notified of upcoming MMO events!'));
    } else if (cmd == 'off') {
      member.removeRole(role).then(() => respond(member, 'You will no longer be notified of MMO events.'));
    } else {
      respond(member, 'Unknown !mmo command.');
    }
  } else {
    return;
    const bpText = blueprintText(text.replace(/[`\n]/g, '').trim());
    if (bpText) {
      const response = '```\n'+bpText.str+'```\n'+
                  Object.keys(bpText.map).map(key => bpText.map[key]+' = '+key.split('_')
                                                   .map(word => word[0].toUpperCase() + word.slice(1))
                                                   .join(' '))
                  .join('\n');
      if (response > 2000) respond(member, 'That blueprint string is too large to scan!');
      else respond(response);
    }
  }
}

// Init storage
storage.initSync();

tmpStorage = storage.getItemSync(config.get('discord.server'))
if (!tmpStorage) {
  tmpStorage = {global: {}, users: {}};
  storage.setItemSync(config.get('discord.server'), tmpStorage);
}

// Init and login bot
init();