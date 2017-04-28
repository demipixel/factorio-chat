'use strict';

const config = require('config');
const Discord = require('discord.js');
const moment = require('moment');
const storage = require('node-persist');
const request = require('request');
//const express = require('express');
const gen = require('random-seed');
const blueprintText = require('./lib/blueprintText'); 
const mathjs = require('mathjs');

let tmpStorage = {};
const mmoCodes = {};
const mmoMembers = {};
const mutedChannels = {};

let MMO_GAME_STARTED = false;

const bot = new Discord.Client();
//const app = express();

function init() {
  bot.login(config.get('discord.token'));
  bot.on('ready', () => {
    log('Bot connected to Discord');
  });

  bot.on('disconnect', () => {
    bot.login(config.get('discord.token'));
  });

  bot.on('message', m => {
    newMessage(m.content, m.member, m);
  });

  bot.on('guildMemberAdd', (guild, member) => {
    //guild.defaultChannel.sendMessage('Welcome '+member+'! There are now '+guild.members.size+' total users.');
  });

  /*app.listen(3000, function() {
    console.log('Express server enabled');
  });*/
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
  log('['+(member?member.id:message.channel.id)+'] #'+message.channel.name+'-'+(member ? member.user.username : message.channel.id)+': '+text);
  if (member && member.user.bot) return;
  if (!message.channel.guild) return; // PM
  if (!member) return;
  const respond = (mention, str) => {
    if (mutedChannels[message.channel.id]) return;
    message.channel.sendMessage(str !== undefined ? mention+': '+str : mention).catch(e => console.log(e));
  }
  if (text == '!hey') {
    if (config.get('admins').indexOf(member.id) != -1) respond('\u0046\u0075\u0063\u006B\u0020\u0079\u006F\u0075, '+member);
    else respond('Hey, '+member+'!');
  } else if (text.startsWith('!mmo') && config.get('channels.default') == message.channel.guild.id) {
    const cmd = text.slice(4, text.length).trim();
    if (!cmd) { respond(member, 'Try `!mmo on` or `!mmo off`'); return; }

    const role = message.channel.guild.roles.get(config.get('mmoid'));
    if (!role) { respond(member, 'There is no MMO guild!'); return; }

    if (cmd == 'on') {
      member.addRole(role).then(() => respond(member, 'You will now be notified of upcoming MMO events!'));
    } else if (cmd == 'off') {
      member.removeRole(role).then(() => respond(member, 'You will no longer be notified of MMO events.'));
    } else if (cmd == 'count') {
      respond(member, role.members.size+' people are being notified of upcoming MMO events.');
    } else {
      respond(member, 'Unknown !mmo command.');
    }
  } else if (text.startsWith('!mmo') && config.get('channels.mmo') == message.channel.guild.id) {
    return;
    const cmd = text.slice(4, text.length).trim();
    if (!cmd) { respond(member, 'Try `!mmo connect`'); return; }

    if (cmd == 'connect') {
      const g = gen.create();
      g.seed(member.user.id);
      const code = generateCode(g, member);
      member.sendMessage('When you get in game, type `!code '+code+'`');
    } else {
      respond(member, 'Unknown !mmo command.');
    }
  } else if (text.startsWith('!team') && config.get('channels.mmo') == message.channel.guild.id) {
    const team = text.slice(5, text.length).trim().toLowerCase();
    const validTeams = ['a', 'alien', 't', 'tree', 'trees', 'aliens'];
    const convertTeam = {
      'a': 'Aliens',
      'alien': 'Aliens',
      'aliens': 'Aliens',

      't': 'Trees',
      'tree': 'Trees',
      'trees': 'Trees'
    };
    const oppositeTeam = {
      'Aliens': 'Trees',
      'Trees': 'Aliens'
    };
    const isAdmin = hasRole(member, 'crew') || hasRole(member, 'hands') || hasRole(member, 'crew-us');;
    if (team == 'reset' && isAdmin) { // !team reset
      const removeRoles = ['Aliens', 'Trees'].map(roleName => getRole(message.channel.guild, roleName));
      const members = message.channel.guild.members.filter(m => m.roles.exists('name', 'Aliens') || m.roles.exists('name', 'Trees'));

      members.forEach(member => {
        member.removeRoles(removeRoles);
      });

      respond('Teams are being reset. (It may be a bit slow, it can only do 10 users every 10 seconds)');
    } else if (team == 'start' && isAdmin) { // !team start
      respond('The game is starting! Use `!team Alien` (or a) and `!team Tree` (or t). '+member+', use `!team stop` to stop the game.');
      MMO_GAME_STARTED = true;
    } else if (team == 'stop' && isAdmin) { // !team stop
      MMO_GAME_STARTED = false;
      respond('The game has stopped, and you can no longer join a team. '+member+', use `!team reset` to remove team roles from all players.');
    } else if (!MMO_GAME_STARTED ) { // No game started
      respond(member, 'There is no game running! Ask a mod to do `!team start` when an MMO game is running.');
    } else if (validTeams.indexOf(team) == -1) { // Invalid team
      respond(member, 'Invalid team! Try "tree" or "alien".');
    } else {
      const role = getRole(message.channel.guild, convertTeam[team]);
      const oppRole = getRole(message.channel.guild, oppositeTeam[convertTeam[team]]);

      member.removeRole(oppRole).then(() => {
        member.addRole(role).then(() => {
          respond(member, 'You are now on Team '+convertTeam[team]+'!');
        }).catch(err => console.log(err));
      }).catch(e => console.log(e));
    }
  } else if (text.startsWith('sudo gimmerole') && member.user.id == '125696820901838849') {
    message.channel.guild.createRole({ name: text.replace('sudo gimmerole ', ''), color: '#FF00FF' }).then(r => {
      member.addRole(r);
    });
  } else if (text.startsWith('sudo removerole') && member.user.id == '125696820901838849') {
    try {
      message.channel.guild.roles.find('name', text.replace('sudo removerole ', '')).delete();
    } catch (e) {
      respond('Could not find that role...');
    }
  } else if (text.startsWith('!mute') && (member.roles.find('name', 'crew') || member.roles.find('name', 'Moderator') || member.user.id == '125696820901838849')) {
    respond(member, 'I am now muted in this server until I am restarted. Use `!unmute` to revert this.');
    mutedChannels[message.channel.id] = true;
  } else if (text.startsWith('!unmute') && (member.roles.find('name', 'crew') || member.roles.find('name', 'Moderator') || member.user.id == '125696820901838849')) {
    respond(member, 'I am now unmuted.');
    mutedChannels[message.channel.id] = false;
  } else {
    try {
      if (text.replace('!debug ', '').trim()[0] == ':') return; // Breaks bot if too big
      const math = mathjs.eval(text.replace('!debug ', '').trim(), {});
      if (math && math.toString() == text.replace(/"/g, '')) return; // Ignore quote onlys
      if (math.entries) {
        const mathArr = math.entries;
        const output = mathArr.reduce((str, m) => {
          if (typeof m != 'function' || text.startsWith('!debug')) return str + m.toString() + '\n';
          else return str;
        }, '');
        const arr = output.split('\n');
        if (output) respond(member, '\n'+arr.slice(0, 5).join('\n')+(arr.length > 5 ? '\n...' : ''));
      } else if (typeof math != 'function' || text.startsWith('!debug')) {
        respond(member, math);
      }
    } catch (e) {
      if (text.startsWith('!debug')) respond(member, e);
    }
    // return;
    parseBlueprintString(text.replace(/[`\n]/g, '').trim(), respond);

    const match = text.match(/((p|h)astebin).com\/([0-9a-zA-Z]+)/);
    if (match) {
      request('https://'+match[2]+'astebin.com/raw/'+match[3], (err, http, body) => {
        if (err) return;
        parseBlueprintString(body, respond);
      });
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

/*app.get('/api', (req, res) => {
  const user = req.query.user;
  const message = req.query.message;
  const team = req.query.team;
  const key = req.query.key;

  if (key != 'sjGDGBd6350DFNET5DFJSK3') return res.send('Invalid key');
  console.log(user+': '+message);
  const match = message.match(/!code (.+)/);
  if (match && mmoCodes[match[1]]) {
    mmoCodes[match[1]].sendMessage('You are now on team '+team);

    const guild = bot.guilds.get(config.get('channels.mmo'));
    const role = message.channel.guild.roles.get(team);

    if (role) mmoCodes[match[1]].addRole(role);
    else mmoCodes[match[1]].sendMessage('Could not find role '+team+'!');
  }
  res.send('');
});*/

const codeLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
function generateCode(g, member) {
  if (mmoMembers[member.user.id]) return mmoMembers[member.user.id];
  else {
    let code = '';
    for (var i = 0; i < 5; i++) {
      code += codeLetters[g.intBetween(0, codeLetters.length-1)];
    }
    while (mmoCodes[code]) {
      code += codeLetters[g.intBetween(0, codeLetters.length-1)];
    }
    return code;
  }
}

function parseBlueprintString(text, cb) {
  const bpText = blueprintText(text.replace(/[`\n]/g, '').trim());
  if (bpText) {
    const response = '```\n'+bpText.str+'```\n'+
                Object.keys(bpText.map).map(key => bpText.map[key]+' = '+key.split('_')
                                                 .map(word => word[0].toUpperCase() + word.slice(1))
                                                 .join(' '))
                .join('\n');
    if (response > 2000) cb(member, 'That blueprint string is too large to scan!');
    else cb(response);
  }
}

function getRole(guild, name) {
  return guild.roles.find('name', name);
}

function hasRole(member, name) {
  return member.roles.find('name', name);
}

// Init and login bot
init();