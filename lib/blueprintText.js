'use strict';

const Blueprint = require('factorio-blueprint');

module.exports = function(s) {
  let bp = null;
  try {
    bp = new Blueprint(s);
  } catch (e) {
    // Not a valid blueprint string
    //console.log(e);
    return null;
  }

  let str = '';
  let map = {};
  let used = [];

  for (let y = Math.floor(bp.topLeft().y); y < Math.floor(bp.bottomRight().y); y++) {
    for (let x = Math.floor(bp.topLeft().x); x < Math.floor(bp.bottomRight().x); x++) {
      const ent = bp.findEntity({ x: x, y: y })
      if (!ent) str += ' ';
      else {
        if (!map[ent.name]) map[ent.name] = determineChar(used, ent.name);
        str += map[ent.name];
      }
    }
    str += '\n';
  }

  return {
    str: str,
    map: map
  };
}

function determineChar(used, name) {
  let poss = name.split(' ').map(str => str[0].toUpperCase()+str[0].toLowerCase()).reduce((final, str) => final + str, '');
  poss += '@#$%&*abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < poss.length; i++) {
    if (used.indexOf(poss[i]) == -1) return used.push(poss[i]) && poss[i];
  }

  return '=';
}