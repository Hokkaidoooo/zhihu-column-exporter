(() => {
  // node_modules/fflate/esm/browser.js
  var ch2 = {};
  var wk = (function(c, id, msg, transfer, cb) {
    var w = new Worker(ch2[id] || (ch2[id] = URL.createObjectURL(new Blob([
      c + ';addEventListener("error",function(e){e=e.error;postMessage({$e$:[e.message,e.code,e.stack]})})'
    ], { type: "text/javascript" }))));
    w.onmessage = function(e) {
      var d = e.data, ed = d.$e$;
      if (ed) {
        var err2 = new Error(ed[0]);
        err2["code"] = ed[1];
        err2.stack = ed[2];
        cb(err2, null);
      } else
        cb(null, d);
    };
    w.postMessage(msg, transfer);
    return w;
  });
  var u8 = Uint8Array;
  var u16 = Uint16Array;
  var i32 = Int32Array;
  var fleb = new u8([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    2,
    2,
    2,
    2,
    3,
    3,
    3,
    3,
    4,
    4,
    4,
    4,
    5,
    5,
    5,
    5,
    0,
    /* unused */
    0,
    0,
    /* impossible */
    0
  ]);
  var fdeb = new u8([
    0,
    0,
    0,
    0,
    1,
    1,
    2,
    2,
    3,
    3,
    4,
    4,
    5,
    5,
    6,
    6,
    7,
    7,
    8,
    8,
    9,
    9,
    10,
    10,
    11,
    11,
    12,
    12,
    13,
    13,
    /* unused */
    0,
    0
  ]);
  var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  var freb = function(eb, start) {
    var b = new u16(31);
    for (var i = 0; i < 31; ++i) {
      b[i] = start += 1 << eb[i - 1];
    }
    var r = new i32(b[30]);
    for (var i = 1; i < 30; ++i) {
      for (var j = b[i]; j < b[i + 1]; ++j) {
        r[j] = j - b[i] << 5 | i;
      }
    }
    return { b, r };
  };
  var _a = freb(fleb, 2);
  var fl = _a.b;
  var revfl = _a.r;
  fl[28] = 258, revfl[258] = 28;
  var _b = freb(fdeb, 0);
  var fd = _b.b;
  var revfd = _b.r;
  var rev = new u16(32768);
  for (i = 0; i < 32768; ++i) {
    x = (i & 43690) >> 1 | (i & 21845) << 1;
    x = (x & 52428) >> 2 | (x & 13107) << 2;
    x = (x & 61680) >> 4 | (x & 3855) << 4;
    rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
  }
  var x;
  var i;
  var hMap = (function(cd, mb, r) {
    var s = cd.length;
    var i = 0;
    var l = new u16(mb);
    for (; i < s; ++i) {
      if (cd[i])
        ++l[cd[i] - 1];
    }
    var le = new u16(mb);
    for (i = 1; i < mb; ++i) {
      le[i] = le[i - 1] + l[i - 1] << 1;
    }
    var co;
    if (r) {
      co = new u16(1 << mb);
      var rvb = 15 - mb;
      for (i = 0; i < s; ++i) {
        if (cd[i]) {
          var sv = i << 4 | cd[i];
          var r_1 = mb - cd[i];
          var v = le[cd[i] - 1]++ << r_1;
          for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
            co[rev[v] >> rvb] = sv;
          }
        }
      }
    } else {
      co = new u16(s);
      for (i = 0; i < s; ++i) {
        if (cd[i]) {
          co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
        }
      }
    }
    return co;
  });
  var flt = new u8(288);
  for (i = 0; i < 144; ++i)
    flt[i] = 8;
  var i;
  for (i = 144; i < 256; ++i)
    flt[i] = 9;
  var i;
  for (i = 256; i < 280; ++i)
    flt[i] = 7;
  var i;
  for (i = 280; i < 288; ++i)
    flt[i] = 8;
  var i;
  var fdt = new u8(32);
  for (i = 0; i < 32; ++i)
    fdt[i] = 5;
  var i;
  var flm = /* @__PURE__ */ hMap(flt, 9, 0);
  var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
  var shft = function(p) {
    return (p + 7) / 8 | 0;
  };
  var slc = function(v, s, e) {
    if (s == null || s < 0)
      s = 0;
    if (e == null || e > v.length)
      e = v.length;
    return new u8(v.subarray(s, e));
  };
  var ec = [
    "unexpected EOF",
    "invalid block type",
    "invalid length/literal",
    "invalid distance",
    "stream finished",
    "no stream handler",
    ,
    // determined by compression function
    "no callback",
    "invalid UTF-8 data",
    "extra field too long",
    "date not in range 1980-2099",
    "filename too long",
    "stream finishing",
    "invalid zip data"
    // determined by unknown compression method
  ];
  var err = function(ind, msg, nt) {
    var e = new Error(msg || ec[ind]);
    e.code = ind;
    if (Error.captureStackTrace)
      Error.captureStackTrace(e, err);
    if (!nt)
      throw e;
    return e;
  };
  var wbits = function(d, p, v) {
    v <<= p & 7;
    var o = p / 8 | 0;
    d[o] |= v;
    d[o + 1] |= v >> 8;
  };
  var wbits16 = function(d, p, v) {
    v <<= p & 7;
    var o = p / 8 | 0;
    d[o] |= v;
    d[o + 1] |= v >> 8;
    d[o + 2] |= v >> 16;
  };
  var hTree = function(d, mb) {
    var t = [];
    for (var i = 0; i < d.length; ++i) {
      if (d[i])
        t.push({ s: i, f: d[i] });
    }
    var s = t.length;
    var t2 = t.slice();
    if (!s)
      return { t: et, l: 0 };
    if (s == 1) {
      var v = new u8(t[0].s + 1);
      v[t[0].s] = 1;
      return { t: v, l: 1 };
    }
    t.sort(function(a, b) {
      return a.f - b.f;
    });
    t.push({ s: -1, f: 25001 });
    var l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;
    t[0] = { s: -1, f: l.f + r.f, l, r };
    while (i1 != s - 1) {
      l = t[t[i0].f < t[i2].f ? i0++ : i2++];
      r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
      t[i1++] = { s: -1, f: l.f + r.f, l, r };
    }
    var maxSym = t2[0].s;
    for (var i = 1; i < s; ++i) {
      if (t2[i].s > maxSym)
        maxSym = t2[i].s;
    }
    var tr = new u16(maxSym + 1);
    var mbt = ln(t[i1 - 1], tr, 0);
    if (mbt > mb) {
      var i = 0, dt = 0;
      var lft = mbt - mb, cst = 1 << lft;
      t2.sort(function(a, b) {
        return tr[b.s] - tr[a.s] || a.f - b.f;
      });
      for (; i < s; ++i) {
        var i2_1 = t2[i].s;
        if (tr[i2_1] > mb) {
          dt += cst - (1 << mbt - tr[i2_1]);
          tr[i2_1] = mb;
        } else
          break;
      }
      dt >>= lft;
      while (dt > 0) {
        var i2_2 = t2[i].s;
        if (tr[i2_2] < mb)
          dt -= 1 << mb - tr[i2_2]++ - 1;
        else
          ++i;
      }
      for (; i >= 0 && dt; --i) {
        var i2_3 = t2[i].s;
        if (tr[i2_3] == mb) {
          --tr[i2_3];
          ++dt;
        }
      }
      mbt = mb;
    }
    return { t: new u8(tr), l: mbt };
  };
  var ln = function(n, l, d) {
    return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
  };
  var lc = function(c) {
    var s = c.length;
    while (s && !c[--s])
      ;
    var cl = new u16(++s);
    var cli = 0, cln = c[0], cls = 1;
    var w = function(v) {
      cl[cli++] = v;
    };
    for (var i = 1; i <= s; ++i) {
      if (c[i] == cln && i != s)
        ++cls;
      else {
        if (!cln && cls > 2) {
          for (; cls > 138; cls -= 138)
            w(32754);
          if (cls > 2) {
            w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
            cls = 0;
          }
        } else if (cls > 3) {
          w(cln), --cls;
          for (; cls > 6; cls -= 6)
            w(8304);
          if (cls > 2)
            w(cls - 3 << 5 | 8208), cls = 0;
        }
        while (cls--)
          w(cln);
        cls = 1;
        cln = c[i];
      }
    }
    return { c: cl.subarray(0, cli), n: s };
  };
  var clen = function(cf, cl) {
    var l = 0;
    for (var i = 0; i < cl.length; ++i)
      l += cf[i] * cl[i];
    return l;
  };
  var wfblk = function(out, pos, dat) {
    var s = dat.length;
    var o = shft(pos + 2);
    out[o] = s & 255;
    out[o + 1] = s >> 8;
    out[o + 2] = out[o] ^ 255;
    out[o + 3] = out[o + 1] ^ 255;
    for (var i = 0; i < s; ++i)
      out[o + i + 4] = dat[i];
    return (o + 4 + s) * 8;
  };
  var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
    wbits(out, p++, final);
    ++lf[256];
    var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
    var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
    var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
    var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
    var lcfreq = new u16(19);
    for (var i = 0; i < lclt.length; ++i)
      ++lcfreq[lclt[i] & 31];
    for (var i = 0; i < lcdt.length; ++i)
      ++lcfreq[lcdt[i] & 31];
    var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
    var nlcc = 19;
    for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
      ;
    var flen = bl + 5 << 3;
    var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
    var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
    if (bs >= 0 && flen <= ftlen && flen <= dtlen)
      return wfblk(out, p, dat.subarray(bs, bs + bl));
    var lm, ll, dm, dl;
    wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
    if (dtlen < ftlen) {
      lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
      var llm = hMap(lct, mlcb, 0);
      wbits(out, p, nlc - 257);
      wbits(out, p + 5, ndc - 1);
      wbits(out, p + 10, nlcc - 4);
      p += 14;
      for (var i = 0; i < nlcc; ++i)
        wbits(out, p + 3 * i, lct[clim[i]]);
      p += 3 * nlcc;
      var lcts = [lclt, lcdt];
      for (var it = 0; it < 2; ++it) {
        var clct = lcts[it];
        for (var i = 0; i < clct.length; ++i) {
          var len = clct[i] & 31;
          wbits(out, p, llm[len]), p += lct[len];
          if (len > 15)
            wbits(out, p, clct[i] >> 5 & 127), p += clct[i] >> 12;
        }
      }
    } else {
      lm = flm, ll = flt, dm = fdm, dl = fdt;
    }
    for (var i = 0; i < li; ++i) {
      var sym = syms[i];
      if (sym > 255) {
        var len = sym >> 18 & 31;
        wbits16(out, p, lm[len + 257]), p += ll[len + 257];
        if (len > 7)
          wbits(out, p, sym >> 23 & 31), p += fleb[len];
        var dst = sym & 31;
        wbits16(out, p, dm[dst]), p += dl[dst];
        if (dst > 3)
          wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
      } else {
        wbits16(out, p, lm[sym]), p += ll[sym];
      }
    }
    wbits16(out, p, lm[256]);
    return p + ll[256];
  };
  var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
  var et = /* @__PURE__ */ new u8(0);
  var dflt = function(dat, lvl, plvl, pre, post, st) {
    var s = st.z || dat.length;
    var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
    var w = o.subarray(pre, o.length - post);
    var lst = st.l;
    var pos = (st.r || 0) & 7;
    if (lvl) {
      if (pos)
        w[0] = st.r >> 3;
      var opt = deo[lvl - 1];
      var n = opt >> 13, c = opt & 8191;
      var msk_1 = (1 << plvl) - 1;
      var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
      var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
      var hsh = function(i2) {
        return (dat[i2] ^ dat[i2 + 1] << bs1_1 ^ dat[i2 + 2] << bs2_1) & msk_1;
      };
      var syms = new i32(25e3);
      var lf = new u16(288), df = new u16(32);
      var lc_1 = 0, eb = 0, i = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
      for (; i + 2 < s; ++i) {
        var hv = hsh(i);
        var imod = i & 32767, pimod = head[hv];
        prev[imod] = pimod;
        head[hv] = imod;
        if (wi <= i) {
          var rem = s - i;
          if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
            pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
            li = lc_1 = eb = 0, bs = i;
            for (var j = 0; j < 286; ++j)
              lf[j] = 0;
            for (var j = 0; j < 30; ++j)
              df[j] = 0;
          }
          var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
          if (rem > 2 && hv == hsh(i - dif)) {
            var maxn = Math.min(n, rem) - 1;
            var maxd = Math.min(32767, i);
            var ml = Math.min(258, rem);
            while (dif <= maxd && --ch_1 && imod != pimod) {
              if (dat[i + l] == dat[i + l - dif]) {
                var nl = 0;
                for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)
                  ;
                if (nl > l) {
                  l = nl, d = dif;
                  if (nl > maxn)
                    break;
                  var mmd = Math.min(dif, nl - 2);
                  var md = 0;
                  for (var j = 0; j < mmd; ++j) {
                    var ti = i - dif + j & 32767;
                    var pti = prev[ti];
                    var cd = ti - pti & 32767;
                    if (cd > md)
                      md = cd, pimod = ti;
                  }
                }
              }
              imod = pimod, pimod = prev[imod];
              dif += imod - pimod & 32767;
            }
          }
          if (d) {
            syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
            var lin = revfl[l] & 31, din = revfd[d] & 31;
            eb += fleb[lin] + fdeb[din];
            ++lf[257 + lin];
            ++df[din];
            wi = i + l;
            ++lc_1;
          } else {
            syms[li++] = dat[i];
            ++lf[dat[i]];
          }
        }
      }
      for (i = Math.max(i, wi); i < s; ++i) {
        syms[li++] = dat[i];
        ++lf[dat[i]];
      }
      pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
      if (!lst) {
        st.r = pos & 7 | w[pos / 8 | 0] << 3;
        pos -= 7;
        st.h = head, st.p = prev, st.i = i, st.w = wi;
      }
    } else {
      for (var i = st.w || 0; i < s + lst; i += 65535) {
        var e = i + 65535;
        if (e >= s) {
          w[pos / 8 | 0] = lst;
          e = s;
        }
        pos = wfblk(w, pos + 1, dat.subarray(i, e));
      }
      st.i = s;
    }
    return slc(o, 0, pre + shft(pos) + post);
  };
  var crct = /* @__PURE__ */ (function() {
    var t = new Int32Array(256);
    for (var i = 0; i < 256; ++i) {
      var c = i, k = 9;
      while (--k)
        c = (c & 1 && -306674912) ^ c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  var crc = function() {
    var c = -1;
    return {
      p: function(d) {
        var cr = c;
        for (var i = 0; i < d.length; ++i)
          cr = crct[cr & 255 ^ d[i]] ^ cr >>> 8;
        c = cr;
      },
      d: function() {
        return ~c;
      }
    };
  };
  var dopt = function(dat, opt, pre, post, st) {
    if (!st) {
      st = { l: 1 };
      if (opt.dictionary) {
        var dict = opt.dictionary.subarray(-32768);
        var newDat = new u8(dict.length + dat.length);
        newDat.set(dict);
        newDat.set(dat, dict.length);
        dat = newDat;
        st.w = dict.length;
      }
    }
    return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
  };
  var mrg = function(a, b) {
    var o = {};
    for (var k in a)
      o[k] = a[k];
    for (var k in b)
      o[k] = b[k];
    return o;
  };
  var wcln = function(fn, fnStr, td2) {
    var dt = fn();
    var st = fn.toString();
    var ks = st.slice(st.indexOf("[") + 1, st.lastIndexOf("]")).replace(/\s+/g, "").split(",");
    for (var i = 0; i < dt.length; ++i) {
      var v = dt[i], k = ks[i];
      if (typeof v == "function") {
        fnStr += ";" + k + "=";
        var st_1 = v.toString();
        if (v.prototype) {
          if (st_1.indexOf("[native code]") != -1) {
            var spInd = st_1.indexOf(" ", 8) + 1;
            fnStr += st_1.slice(spInd, st_1.indexOf("(", spInd));
          } else {
            fnStr += st_1;
            for (var t in v.prototype)
              fnStr += ";" + k + ".prototype." + t + "=" + v.prototype[t].toString();
          }
        } else
          fnStr += st_1;
      } else
        td2[k] = v;
    }
    return fnStr;
  };
  var ch = [];
  var cbfs = function(v) {
    var tl = [];
    for (var k in v) {
      if (v[k].buffer) {
        tl.push((v[k] = new v[k].constructor(v[k])).buffer);
      }
    }
    return tl;
  };
  var wrkr = function(fns, init, id, cb) {
    if (!ch[id]) {
      var fnStr = "", td_1 = {}, m = fns.length - 1;
      for (var i = 0; i < m; ++i)
        fnStr = wcln(fns[i], fnStr, td_1);
      ch[id] = { c: wcln(fns[m], fnStr, td_1), e: td_1 };
    }
    var td2 = mrg({}, ch[id].e);
    return wk(ch[id].c + ";onmessage=function(e){for(var k in e.data)self[k]=e.data[k];onmessage=" + init.toString() + "}", id, td2, cbfs(td2), cb);
  };
  var bDflt = function() {
    return [u8, u16, i32, fleb, fdeb, clim, revfl, revfd, flm, flt, fdm, fdt, rev, deo, et, hMap, wbits, wbits16, hTree, ln, lc, clen, wfblk, wblk, shft, slc, dflt, dopt, deflateSync, pbf];
  };
  var pbf = function(msg) {
    return postMessage(msg, [msg.buffer]);
  };
  var cbify = function(dat, opts, fns, init, id, cb) {
    var w = wrkr(fns, init, id, function(err2, dat2) {
      w.terminate();
      cb(err2, dat2);
    });
    w.postMessage([dat, opts], opts.consume ? [dat.buffer] : []);
    return function() {
      w.terminate();
    };
  };
  var wbytes = function(d, b, v) {
    for (; v; ++b)
      d[b] = v, v >>>= 8;
  };
  function deflate(data, opts, cb) {
    if (!cb)
      cb = opts, opts = {};
    if (typeof cb != "function")
      err(7);
    return cbify(data, opts, [
      bDflt
    ], function(ev) {
      return pbf(deflateSync(ev.data[0], ev.data[1]));
    }, 0, cb);
  }
  function deflateSync(data, opts) {
    return dopt(data, opts || {}, 0, 0);
  }
  var fltn = function(d, p, t, o) {
    for (var k in d) {
      var val = d[k], n = p + k, op = o;
      if (Array.isArray(val))
        op = mrg(o, val[1]), val = val[0];
      if (ArrayBuffer.isView(val))
        t[n] = [val, op];
      else {
        t[n += "/"] = [new u8(0), op];
        fltn(val, n, t, o);
      }
    }
  };
  var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder();
  var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
  var tds = 0;
  try {
    td.decode(et, { stream: true });
    tds = 1;
  } catch (e) {
  }
  function strToU8(str, latin1) {
    if (latin1) {
      var ar_1 = new u8(str.length);
      for (var i = 0; i < str.length; ++i)
        ar_1[i] = str.charCodeAt(i);
      return ar_1;
    }
    if (te)
      return te.encode(str);
    var l = str.length;
    var ar = new u8(str.length + (str.length >> 1));
    var ai = 0;
    var w = function(v) {
      ar[ai++] = v;
    };
    for (var i = 0; i < l; ++i) {
      if (ai + 5 > ar.length) {
        var n = new u8(ai + 8 + (l - i << 1));
        n.set(ar);
        ar = n;
      }
      var c = str.charCodeAt(i);
      if (c < 128 || latin1)
        w(c);
      else if (c < 2048)
        w(192 | c >> 6), w(128 | c & 63);
      else if (c > 55295 && c < 57344)
        c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
      else
        w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
    }
    return slc(ar, 0, ai);
  }
  var exfl = function(ex) {
    var le = 0;
    if (ex) {
      for (var k in ex) {
        var l = ex[k].length;
        if (l > 65535)
          err(9);
        le += l + 4;
      }
    }
    return le;
  };
  var wzh = function(d, b, f, fn, u, c, ce, co) {
    var fl2 = fn.length, ex = f.extra, col = co && co.length;
    var exl = exfl(ex);
    wbytes(d, b, ce != null ? 33639248 : 67324752), b += 4;
    if (ce != null)
      d[b++] = 20, d[b++] = f.os;
    d[b] = 20, b += 2;
    d[b++] = f.flag << 1 | (c < 0 && 8), d[b++] = u && 8;
    d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
    var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
    if (y < 0 || y > 119)
      err(10);
    wbytes(d, b, y << 25 | dt.getMonth() + 1 << 21 | dt.getDate() << 16 | dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1), b += 4;
    if (c != -1) {
      wbytes(d, b, f.crc);
      wbytes(d, b + 4, c < 0 ? -c - 2 : c);
      wbytes(d, b + 8, f.size);
    }
    wbytes(d, b + 12, fl2);
    wbytes(d, b + 14, exl), b += 16;
    if (ce != null) {
      wbytes(d, b, col);
      wbytes(d, b + 6, f.attrs);
      wbytes(d, b + 10, ce), b += 14;
    }
    d.set(fn, b);
    b += fl2;
    if (exl) {
      for (var k in ex) {
        var exf = ex[k], l = exf.length;
        wbytes(d, b, +k);
        wbytes(d, b + 2, l);
        d.set(exf, b + 4), b += 4 + l;
      }
    }
    if (col)
      d.set(co, b), b += col;
    return b;
  };
  var wzf = function(o, b, c, d, e) {
    wbytes(o, b, 101010256);
    wbytes(o, b + 8, c);
    wbytes(o, b + 10, c);
    wbytes(o, b + 12, d);
    wbytes(o, b + 16, e);
  };
  function zip(data, opts, cb) {
    if (!cb)
      cb = opts, opts = {};
    if (typeof cb != "function")
      err(7);
    var r = {};
    fltn(data, "", r, opts);
    var k = Object.keys(r);
    var lft = k.length, o = 0, tot = 0;
    var slft = lft, files = new Array(lft);
    var term = [];
    var tAll = function() {
      for (var i2 = 0; i2 < term.length; ++i2)
        term[i2]();
    };
    var cbd = function(a, b) {
      mt(function() {
        cb(a, b);
      });
    };
    mt(function() {
      cbd = cb;
    });
    var cbf = function() {
      var out = new u8(tot + 22), oe = o, cdl = tot - o;
      tot = 0;
      for (var i2 = 0; i2 < slft; ++i2) {
        var f = files[i2];
        try {
          var l = f.c.length;
          wzh(out, tot, f, f.f, f.u, l);
          var badd = 30 + f.f.length + exfl(f.extra);
          var loc = tot + badd;
          out.set(f.c, loc);
          wzh(out, o, f, f.f, f.u, l, tot, f.m), o += 16 + badd + (f.m ? f.m.length : 0), tot = loc + l;
        } catch (e) {
          return cbd(e, null);
        }
      }
      wzf(out, o, files.length, cdl, oe);
      cbd(null, out);
    };
    if (!lft)
      cbf();
    var _loop_1 = function(i2) {
      var fn = k[i2];
      var _a2 = r[fn], file = _a2[0], p = _a2[1];
      var c = crc(), size = file.length;
      c.p(file);
      var f = strToU8(fn), s = f.length;
      var com = p.comment, m = com && strToU8(com), ms = m && m.length;
      var exl = exfl(p.extra);
      var compression = p.level == 0 ? 0 : 8;
      var cbl = function(e, d) {
        if (e) {
          tAll();
          cbd(e, null);
        } else {
          var l = d.length;
          files[i2] = mrg(p, {
            size,
            crc: c.d(),
            c: d,
            f,
            m,
            u: s != fn.length || m && com.length != ms,
            compression
          });
          o += 30 + s + exl + l;
          tot += 76 + 2 * (s + exl) + (ms || 0) + l;
          if (!--lft)
            cbf();
        }
      };
      if (s > 65535)
        cbl(err(11, 0, 1), null);
      if (!compression)
        cbl(null, file);
      else if (size < 16e4) {
        try {
          cbl(null, deflateSync(file, p));
        } catch (e) {
          cbl(e, null);
        }
      } else
        term.push(deflate(file, p, cbl));
    };
    for (var i = 0; i < slft; ++i) {
      _loop_1(i);
    }
    return tAll;
  }
  var mt = typeof queueMicrotask == "function" ? queueMicrotask : typeof setTimeout == "function" ? setTimeout : function(fn) {
    fn();
  };

  // node_modules/lucide/dist/esm/createElement.js
  var createElement = (tag, attrs, children = []) => {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs).forEach((name) => {
      element.setAttribute(name, String(attrs[name]));
    });
    if (children.length) {
      children.forEach((child) => {
        const childElement = createElement(...child);
        element.appendChild(childElement);
      });
    }
    return element;
  };
  var createElement$1 = ([tag, attrs, children]) => createElement(tag, attrs, children);

  // node_modules/lucide/dist/esm/replaceElement.js
  var getAttrs = (element) => Array.from(element.attributes).reduce((attrs, attr) => {
    attrs[attr.name] = attr.value;
    return attrs;
  }, {});
  var getClassNames = (attrs) => {
    if (typeof attrs === "string")
      return attrs;
    if (!attrs || !attrs.class)
      return "";
    if (attrs.class && typeof attrs.class === "string") {
      return attrs.class.split(" ");
    }
    if (attrs.class && Array.isArray(attrs.class)) {
      return attrs.class;
    }
    return "";
  };
  var combineClassNames = (arrayOfClassnames) => {
    const classNameArray = arrayOfClassnames.flatMap(getClassNames);
    return classNameArray.map((classItem) => classItem.trim()).filter(Boolean).filter((value, index, self) => self.indexOf(value) === index).join(" ");
  };
  var toPascalCase = (string) => string.replace(/(\w)(\w*)(_|-|\s*)/g, (g0, g1, g2) => g1.toUpperCase() + g2.toLowerCase());
  var replaceElement = (element, { nameAttr, icons, attrs }) => {
    const iconName = element.getAttribute(nameAttr);
    if (iconName == null)
      return;
    const ComponentName = toPascalCase(iconName);
    const iconNode = icons[ComponentName];
    if (!iconNode) {
      return console.warn(
        `${element.outerHTML} icon name was not found in the provided icons object.`
      );
    }
    const elementAttrs = getAttrs(element);
    const [tag, iconAttributes, children] = iconNode;
    const iconAttrs = {
      ...iconAttributes,
      "data-lucide": iconName,
      ...attrs,
      ...elementAttrs
    };
    const classNames = combineClassNames(["lucide", `lucide-${iconName}`, elementAttrs, attrs]);
    if (classNames) {
      Object.assign(iconAttrs, {
        class: classNames
      });
    }
    const svgElement = createElement$1([tag, iconAttrs, children]);
    return element.parentNode?.replaceChild(svgElement, element);
  };

  // node_modules/lucide/dist/esm/defaultAttributes.js
  var defaultAttributes = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  };

  // node_modules/lucide/dist/esm/icons/book-down.js
  var BookDown = [
    "svg",
    defaultAttributes,
    [
      ["path", { d: "M12 13V7" }],
      [
        "path",
        {
          d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"
        }
      ],
      ["path", { d: "m9 10 3 3 3-3" }]
    ]
  ];

  // node_modules/lucide/dist/esm/icons/circle-check.js
  var CircleCheck = [
    "svg",
    defaultAttributes,
    [
      ["circle", { cx: "12", cy: "12", r: "10" }],
      ["path", { d: "m9 12 2 2 4-4" }]
    ]
  ];

  // node_modules/lucide/dist/esm/icons/download.js
  var Download = [
    "svg",
    defaultAttributes,
    [
      ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
      ["polyline", { points: "7 10 12 15 17 10" }],
      ["line", { x1: "12", x2: "12", y1: "15", y2: "3" }]
    ]
  ];

  // node_modules/lucide/dist/esm/icons/file-archive.js
  var FileArchive = [
    "svg",
    defaultAttributes,
    [
      ["path", { d: "M10 12v-1" }],
      ["path", { d: "M10 18v-2" }],
      ["path", { d: "M10 7V6" }],
      ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }],
      ["path", { d: "M15.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v16a2 2 0 0 0 .274 1.01" }],
      ["circle", { cx: "10", cy: "20", r: "2" }]
    ]
  ];

  // node_modules/lucide/dist/esm/icons/loader-circle.js
  var LoaderCircle = [
    "svg",
    defaultAttributes,
    [["path", { d: "M21 12a9 9 0 1 1-6.219-8.56" }]]
  ];

  // node_modules/lucide/dist/esm/icons/rotate-ccw.js
  var RotateCcw = [
    "svg",
    defaultAttributes,
    [
      ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }],
      ["path", { d: "M3 3v5h5" }]
    ]
  ];

  // node_modules/lucide/dist/esm/icons/square.js
  var Square = [
    "svg",
    defaultAttributes,
    [["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }]]
  ];

  // node_modules/lucide/dist/esm/icons/triangle-alert.js
  var TriangleAlert = [
    "svg",
    defaultAttributes,
    [
      ["path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" }],
      ["path", { d: "M12 9v4" }],
      ["path", { d: "M12 17h.01" }]
    ]
  ];

  // node_modules/lucide/dist/esm/lucide.js
  var createIcons = ({ icons = {}, nameAttr = "data-lucide", attrs = {} } = {}) => {
    if (!Object.values(icons).length) {
      throw new Error(
        "Please provide an icons object.\nIf you want to use all the icons you can import it like:\n `import { createIcons, icons } from 'lucide';\nlucide.createIcons({icons});`"
      );
    }
    if (typeof document === "undefined") {
      throw new Error("`createIcons()` only works in a browser environment.");
    }
    const elementsToReplace = document.querySelectorAll(`[${nameAttr}]`);
    Array.from(elementsToReplace).forEach(
      (element) => replaceElement(element, { nameAttr, icons, attrs })
    );
    if (nameAttr === "data-lucide") {
      const deprecatedElements = document.querySelectorAll("[icon-name]");
      if (deprecatedElements.length > 0) {
        console.warn(
          "[Lucide] Some icons were found with the now deprecated icon-name attribute. These will still be replaced for backwards compatibility, but will no longer be supported in v1.0 and you should switch to data-lucide"
        );
        Array.from(deprecatedElements).forEach(
          (element) => replaceElement(element, { nameAttr: "icon-name", icons, attrs })
        );
      }
    }
  };

  // src/retry.js
  async function retryOperation(operation, options = {}) {
    const {
      attempts = 3,
      delays = [1500, 3500],
      shouldRetry = () => true,
      onRetry = () => {
      },
      wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
    } = options;
    if (!Number.isInteger(attempts) || attempts < 1) throw new TypeError("attempts \u5FC5\u987B\u662F\u6B63\u6574\u6570");
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await operation(attempt);
      } catch (error) {
        lastError = error;
        if (attempt >= attempts || !shouldRetry(error, attempt)) throw error;
        const delayMs = delays[Math.min(attempt - 1, delays.length - 1)] ?? 0;
        await onRetry({ error, attempt, nextAttempt: attempt + 1, delayMs });
        if (delayMs > 0) await wait(delayMs);
      }
    }
    throw lastError;
  }

  // src/export-results.js
  function collectUnexportedArticles({ links, articles, failures, reason }) {
    const successfulIds = new Set(articles.map((article) => article.sectionId));
    const failuresById = new Map(failures.map((failure) => [failure.sectionId, failure]));
    return links.filter((link) => !successfulIds.has(link.sectionId)).map((link) => {
      const failure = failuresById.get(link.sectionId);
      if (failure) return failure;
      return {
        sectionId: link.sectionId,
        title: link.title,
        url: link.url,
        reason,
        accessDenied: false
      };
    });
  }

  // src/shared.js
  var WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
  function isZhihuUrl(input) {
    try {
      return /(^|\.)zhihu\.com$/i.test(new URL(input).hostname);
    } catch {
      return false;
    }
  }
  function parsePaidColumnUrl(input) {
    let url;
    try {
      url = new URL(input);
    } catch {
      return null;
    }
    if (!isZhihuUrl(url.href)) return null;
    const path = url.pathname.replace(/\/+$/, "");
    let match = path.match(/^\/column\/(c_\d+)$/);
    if (url.hostname === "www.zhihu.com" && match) {
      return { columnId: match[1], sectionId: null, kind: "catalog" };
    }
    match = path.match(/^\/p\/(\d+)$/);
    if ((url.hostname === "zhuanlan.zhihu.com" || url.hostname === "www.zhihu.com") && match) {
      return { columnId: null, sectionId: match[1], kind: "section" };
    }
    match = path.match(/^\/market\/paid_column\/(\d+)(?:\/section\/(\d+))?$/);
    if (match) {
      return {
        columnId: match[1],
        sectionId: match[2] || null,
        kind: match[2] ? "section" : "catalog"
      };
    }
    match = path.match(/^\/xen\/market\/remix\/paid_column\/(\d+)(?:\/section\/(\d+))?$/);
    if (match) {
      return {
        columnId: match[1],
        sectionId: match[2] || null,
        kind: match[2] ? "section" : "catalog"
      };
    }
    match = path.match(/(?:^|\/)paid_column\/(\d+)(?:\/section\/(\d+))?(?:\/|$)/);
    if (match) {
      return {
        columnId: match[1],
        sectionId: match[2] || null,
        kind: match[2] ? "section" : "catalog"
      };
    }
    return null;
  }
  function sanitizeFilename(value, fallback = "\u672A\u547D\u540D", maxLength = 80) {
    let output = String(value || "").replace(/[\u0000-\u001f<>:"/\\|?*]/g, "_").replace(/\s+/g, " ").replace(/[. ]+$/g, "").trim();
    if (!output) output = fallback;
    if (WINDOWS_RESERVED.test(output)) output = `_${output}`;
    return Array.from(output).slice(0, maxLength).join("");
  }
  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }
  function padNumber(value, width = 3) {
    return String(value).padStart(width, "0");
  }
  function sleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
  function uniqueBy(items, keyOf) {
    const seen = /* @__PURE__ */ new Set();
    return items.filter((item) => {
      const key = keyOf(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // src/article-readiness.js
  var NOT_READY = "";
  async function settleFingerprint({
    sample,
    wait,
    attempts = 200,
    intervalMs = 100,
    stableSamples = 3,
    minimumStableMs = 300,
    emptyLimit = Infinity
  }) {
    if (typeof sample !== "function" || typeof wait !== "function") {
      throw new TypeError("\u6B63\u6587\u91C7\u6837\u5668\u548C\u7B49\u5F85\u51FD\u6570\u5FC5\u987B\u662F\u51FD\u6570");
    }
    if (!Number.isInteger(attempts) || attempts < 1 || !Number.isInteger(stableSamples) || stableSamples < 1 || !Number.isFinite(minimumStableMs) || minimumStableMs < 0) {
      throw new TypeError("\u6B63\u6587\u7B49\u5F85\u6B21\u6570\u5FC5\u987B\u662F\u6B63\u6574\u6570");
    }
    let lastFingerprint = NOT_READY;
    let matchingSamples = 0;
    let stableDurationMs = 0;
    let samples = 0;
    let consecutiveEmpty = 0;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0) await wait(intervalMs);
      const fingerprint = String(await sample() ?? NOT_READY);
      samples += 1;
      if (!fingerprint) {
        lastFingerprint = NOT_READY;
        matchingSamples = 0;
        stableDurationMs = 0;
        consecutiveEmpty += 1;
        if (consecutiveEmpty >= emptyLimit) break;
        continue;
      }
      consecutiveEmpty = 0;
      if (fingerprint === lastFingerprint) {
        matchingSamples += 1;
        stableDurationMs += intervalMs;
      } else {
        matchingSamples = 1;
        stableDurationMs = 0;
      }
      lastFingerprint = fingerprint;
      if (matchingSamples >= stableSamples && stableDurationMs >= minimumStableMs) {
        return { settled: true, fingerprint, samples };
      }
    }
    return { settled: false, fingerprint: lastFingerprint, samples };
  }
  function isMessageChannelClosed(error) {
    return /(message channel closed|receiving end does not exist|could not establish connection)/i.test(error?.message || String(error || ""));
  }
  function messageChannelClosedError() {
    return new Error("\u6587\u7AE0\u9875\u5728\u6B63\u6587\u63D0\u53D6\u671F\u95F4\u53D1\u751F\u4E86\u8DF3\u8F6C\uFF0C\u7B49\u5F85\u9875\u9762\u7A33\u5B9A\u540E\u4ECD\u672A\u8FD4\u56DE\u7ED3\u679C");
  }

  // src/cached-batch.js
  function validateArticleBatchResponse(response, expectedSectionIds) {
    if (!response?.ok) throw new Error(response?.reason || "\u6279\u91CF\u6B63\u6587\u63D0\u53D6\u5931\u8D25");
    if (!Array.isArray(response.articles)) throw new Error("\u6279\u91CF\u6B63\u6587\u7ED3\u679C\u683C\u5F0F\u65E0\u6548");
    const expected = expectedSectionIds.map(String);
    const expectedSet = new Set(expected);
    const byId = /* @__PURE__ */ new Map();
    for (const article of response.articles) {
      const sectionId = String(article?.sectionId || "");
      if (!expectedSet.has(sectionId)) throw new Error(`\u6279\u91CF\u7ED3\u679C\u5305\u542B\u672A\u8BF7\u6C42\u7684\u6587\u7AE0\uFF1A${sectionId || "\u672A\u77E5"}`);
      if (byId.has(sectionId)) throw new Error(`\u6279\u91CF\u7ED3\u679C\u91CD\u590D\u8FD4\u56DE\u6587\u7AE0\uFF1A${sectionId}`);
      byId.set(sectionId, article);
    }
    const missing = expected.filter((sectionId) => !byId.has(sectionId));
    if (missing.length) throw new Error(`\u6279\u91CF\u7ED3\u679C\u7F3A\u5C11\u6587\u7AE0\uFF1A${missing.join("\u3001")}`);
    return expected.map((sectionId) => byId.get(sectionId));
  }

  // src/cache-validation.js
  var MIN_TEXT_LENGTH = 400;
  var MIN_LENGTH_RATIO = 0.8;
  var MIN_CONTENT_COVERAGE = 0.7;
  var MIN_ORDER_COVERAGE = 0.65;
  var MIN_BOUNDARY_COVERAGE = 0.81;
  var CONTENT_NGRAM_SIZE = 8;
  var BOUNDARY_NGRAM_SIZE = 5;
  var ANCHOR_STEP = 24;
  var ANCHOR_POSITION_TOLERANCE = 0.08;
  var MAX_ANCHOR_CANDIDATES = 32;
  var RARE_ANCHOR_STEP = 12;
  var MAX_RARE_SOURCE_OCCURRENCES = 2;
  var MAX_RARE_TARGET_OCCURRENCES = 4;
  var MIN_RARE_ANCHORS = 8;
  var MIN_STRICT_PREFIX_TAIL = 64;
  var CONTAINMENT_COVERAGE = 0.9;
  var MISSING_SAMPLE_LENGTH = 60;
  function browserHtmlToText(html) {
    if (typeof DOMParser !== "function") throw new Error("\u5F53\u524D\u73AF\u5883\u65E0\u6CD5\u89E3\u6790\u6B63\u6587 HTML");
    const parsed = new DOMParser().parseFromString(`<body>${String(html || "")}</body>`, "text/html");
    return parsed.body?.textContent || "";
  }
  function comparableText(value) {
    return String(value || "").normalize("NFKC").replace(/\u2212/g, "-").replace(/[^\p{L}\p{N}\p{Sm}+\-*\/=<>^%|~&]+/gu, "");
  }
  function countNgrams(text, gramSize) {
    const counts = /* @__PURE__ */ new Map();
    for (let offset = 0; offset <= text.length - gramSize; offset += 1) {
      const gram = text.slice(offset, offset + gramSize);
      counts.set(gram, (counts.get(gram) || 0) + 1);
    }
    return counts;
  }
  function bidirectionalNgramCoverage(left, right, gramSize) {
    if (!left.length || !right.length) return { left: 0, right: 0 };
    if (left === right) return { left: 1, right: 1 };
    if (left.length < gramSize || right.length < gramSize) return { left: 0, right: 0 };
    const countedText = left.length <= right.length ? left : right;
    const scannedText = countedText === left ? right : left;
    const availableCounts = countNgrams(countedText, gramSize);
    let sharedGrams = 0;
    for (let offset = 0; offset <= scannedText.length - gramSize; offset += 1) {
      const gram = scannedText.slice(offset, offset + gramSize);
      const available = availableCounts.get(gram) || 0;
      if (!available) continue;
      sharedGrams += 1;
      if (available === 1) availableCounts.delete(gram);
      else availableCounts.set(gram, available - 1);
    }
    return {
      left: sharedGrams / (left.length - gramSize + 1),
      right: sharedGrams / (right.length - gramSize + 1)
    };
  }
  function lowerBound(values, target) {
    let low = 0;
    let high = values.length;
    while (low < high) {
      const middle = low + high >> 1;
      if (values[middle] < target) low = middle + 1;
      else high = middle;
    }
    return low;
  }
  function sampledAnchors(text, gramSize, step) {
    const anchors = [];
    const finalOffset = text.length - gramSize;
    for (let offset = 0; offset <= finalOffset; offset += step) {
      anchors.push({ gram: text.slice(offset, offset + gramSize), offset });
    }
    if (anchors.at(-1)?.offset !== finalOffset) {
      anchors.push({ gram: text.slice(finalOffset), offset: finalOffset });
    }
    return anchors;
  }
  function orderedAnchorCoverage(source, target, gramSize = CONTENT_NGRAM_SIZE, step = ANCHOR_STEP) {
    const anchors = sampledAnchors(source, gramSize, step);
    if (!anchors.length) return 0;
    const requiredGrams = new Set(anchors.map((anchor) => anchor.gram));
    const positionsByGram = /* @__PURE__ */ new Map();
    for (let offset = 0; offset <= target.length - gramSize; offset += 1) {
      const gram = target.slice(offset, offset + gramSize);
      if (!requiredGrams.has(gram)) continue;
      const positions = positionsByGram.get(gram) || [];
      positions.push(offset);
      positionsByGram.set(gram, positions);
    }
    const sourceSpan = Math.max(1, source.length - gramSize);
    const targetSpan = Math.max(1, target.length - gramSize);
    const radius = Math.max(96, Math.floor(target.length * ANCHOR_POSITION_TOLERANCE));
    const increasingTails = [];
    for (const anchor of anchors) {
      const expectedPosition = anchor.offset / sourceSpan * targetSpan;
      const positions = positionsByGram.get(anchor.gram) || [];
      const rangeStart = lowerBound(positions, expectedPosition - radius);
      const rangeEnd = lowerBound(positions, expectedPosition + radius + 1);
      if (rangeStart === rangeEnd) continue;
      const nearest = lowerBound(positions, expectedPosition);
      let candidateStart = Math.max(rangeStart, nearest - Math.floor(MAX_ANCHOR_CANDIDATES / 2));
      let candidateEnd = Math.min(rangeEnd, candidateStart + MAX_ANCHOR_CANDIDATES);
      candidateStart = Math.max(rangeStart, candidateEnd - MAX_ANCHOR_CANDIDATES);
      for (let index = candidateEnd - 1; index >= candidateStart; index -= 1) {
        const position = positions[index];
        const tailIndex = lowerBound(increasingTails, position);
        increasingTails[tailIndex] = position;
      }
    }
    return increasingTails.length / anchors.length;
  }
  function rareOrderedAnchorCoverage(source, target, gramSize = CONTENT_NGRAM_SIZE) {
    const sourceCounts = countNgrams(source, gramSize);
    const anchors = [];
    let lastOffset = -RARE_ANCHOR_STEP;
    for (let offset = 0; offset <= source.length - gramSize; offset += 1) {
      if (offset - lastOffset < RARE_ANCHOR_STEP) continue;
      const gram = source.slice(offset, offset + gramSize);
      if ((sourceCounts.get(gram) || 0) > MAX_RARE_SOURCE_OCCURRENCES) continue;
      anchors.push(gram);
      lastOffset = offset;
    }
    sourceCounts.clear();
    if (anchors.length < MIN_RARE_ANCHORS) return null;
    const requiredGrams = new Set(anchors);
    const positionsByGram = /* @__PURE__ */ new Map();
    for (let offset = 0; offset <= target.length - gramSize; offset += 1) {
      const gram = target.slice(offset, offset + gramSize);
      if (!requiredGrams.has(gram)) continue;
      const positions = positionsByGram.get(gram) || [];
      if (positions.length <= MAX_RARE_TARGET_OCCURRENCES) positions.push(offset);
      positionsByGram.set(gram, positions);
    }
    const increasingTails = [];
    for (const gram of anchors) {
      const positions = positionsByGram.get(gram) || [];
      if (positions.length > MAX_RARE_TARGET_OCCURRENCES) continue;
      for (let index = positions.length - 1; index >= 0; index -= 1) {
        const position = positions[index];
        const tailIndex = lowerBound(increasingTails, position);
        increasingTails[tailIndex] = position;
      }
    }
    return increasingTails.length / anchors.length;
  }
  function combinedOrderCoverage(source, target) {
    const positionalCoverage = orderedAnchorCoverage(source, target);
    const rareCoverage = rareOrderedAnchorCoverage(source, target);
    return rareCoverage === null ? positionalCoverage : Math.min(positionalCoverage, rareCoverage);
  }
  function boundaryCoverage(left, right) {
    const minimumLength = Math.min(left.length, right.length);
    const windowSize = Math.min(512, Math.max(160, Math.floor(minimumLength * 0.1)));
    const head = bidirectionalNgramCoverage(
      left.slice(0, windowSize),
      right.slice(0, windowSize),
      BOUNDARY_NGRAM_SIZE
    );
    const tail = bidirectionalNgramCoverage(
      left.slice(-windowSize),
      right.slice(-windowSize),
      BOUNDARY_NGRAM_SIZE
    );
    return {
      start: Math.min(head.left, head.right),
      end: Math.min(tail.left, tail.right)
    };
  }
  function firstUncoveredOffset(source, reference, gramSize) {
    if (source.length < gramSize || reference.length < gramSize) return 0;
    const referenceGrams = /* @__PURE__ */ new Set();
    for (let offset = 0; offset <= reference.length - gramSize; offset += 1) {
      referenceGrams.add(reference.slice(offset, offset + gramSize));
    }
    for (let offset = 0; offset <= source.length - gramSize; offset += 1) {
      if (!referenceGrams.has(source.slice(offset, offset + gramSize))) return offset;
    }
    return -1;
  }
  function missingContentSample(longer, shorter) {
    const offset = firstUncoveredOffset(longer, shorter, CONTENT_NGRAM_SIZE);
    if (offset < 0) return "";
    return longer.slice(offset, offset + MISSING_SAMPLE_LENGTH);
  }
  function classifyMismatch({ apiLength, pageLength, apiCoverage, pageCoverage }) {
    if (apiLength < pageLength && apiCoverage >= CONTAINMENT_COVERAGE) return "apiTruncated";
    if (pageLength < apiLength && pageCoverage >= CONTAINMENT_COVERAGE) return "pageTruncated";
    return "different";
  }
  function roundedRatio(value) {
    return Math.round(value * 1e4) / 1e4;
  }
  function resultWithMetrics(matches, reason, metrics = {}) {
    return {
      matches,
      reason,
      kind: String(metrics.kind || (matches ? "acceptable" : "different")),
      apiLength: Number(metrics.apiLength || 0),
      pageLength: Number(metrics.pageLength || 0),
      lengthRatio: roundedRatio(metrics.lengthRatio || 0),
      apiCoverage: roundedRatio(metrics.apiCoverage || 0),
      pageCoverage: roundedRatio(metrics.pageCoverage || 0),
      apiOrderCoverage: roundedRatio(metrics.apiOrderCoverage || 0),
      pageOrderCoverage: roundedRatio(metrics.pageOrderCoverage || 0),
      startCoverage: roundedRatio(metrics.startCoverage || 0),
      endCoverage: roundedRatio(metrics.endCoverage || 0),
      missingSample: String(metrics.missingSample || "")
    };
  }
  function compareArticleApiWithPage(apiArticle, pageArticle, htmlToText = browserHtmlToText) {
    if (!apiArticle?.ok || !pageArticle?.ok) {
      return resultWithMetrics(false, "\u63A5\u53E3\u6216\u6B63\u5E38\u6587\u7AE0\u9875\u672A\u6210\u529F\u63D0\u53D6\u6B63\u6587", { kind: "unavailable" });
    }
    const apiText = comparableText(htmlToText(apiArticle.html));
    const pageText = comparableText(htmlToText(pageArticle.html));
    const apiLength = apiText.length;
    const pageLength = pageText.length;
    const longerLength = Math.max(apiLength, pageLength);
    const lengthRatio = longerLength ? Math.min(apiLength, pageLength) / longerLength : 0;
    const baseMetrics = { apiLength, pageLength, lengthRatio };
    if (apiLength < MIN_TEXT_LENGTH || pageLength < MIN_TEXT_LENGTH) {
      return resultWithMetrics(false, `\u6B63\u6587\u8FC7\u77ED\uFF0C\u89C4\u8303\u5316\u540E\u81F3\u5C11\u9700\u8981 ${MIN_TEXT_LENGTH} \u5B57`, {
        ...baseMetrics,
        kind: "tooShort"
      });
    }
    if (apiText === pageText) {
      return resultWithMetrics(true, "\u6B63\u6587\u5B8C\u5168\u4E00\u81F4", {
        ...baseMetrics,
        kind: "identical",
        apiCoverage: 1,
        pageCoverage: 1,
        apiOrderCoverage: 1,
        pageOrderCoverage: 1,
        startCoverage: 1,
        endCoverage: 1
      });
    }
    const contentCoverage = bidirectionalNgramCoverage(apiText, pageText, CONTENT_NGRAM_SIZE);
    const boundary = boundaryCoverage(apiText, pageText);
    const strictPrefixTail = apiText.startsWith(pageText) || pageText.startsWith(apiText) ? Math.abs(apiLength - pageLength) : 0;
    const metrics = {
      ...baseMetrics,
      kind: classifyMismatch({
        apiLength,
        pageLength,
        apiCoverage: contentCoverage.left,
        pageCoverage: contentCoverage.right
      }),
      apiCoverage: contentCoverage.left,
      pageCoverage: contentCoverage.right,
      apiOrderCoverage: combinedOrderCoverage(apiText, pageText),
      pageOrderCoverage: combinedOrderCoverage(pageText, apiText),
      startCoverage: boundary.start,
      endCoverage: boundary.end,
      missingSample: apiLength >= pageLength ? missingContentSample(apiText, pageText) : missingContentSample(pageText, apiText)
    };
    if (lengthRatio < MIN_LENGTH_RATIO) {
      return resultWithMetrics(false, "\u4E24\u4EFD\u6B63\u6587\u957F\u5EA6\u5DEE\u5F02\u8FC7\u5927", metrics);
    }
    if (strictPrefixTail >= MIN_STRICT_PREFIX_TAIL) {
      return resultWithMetrics(false, "\u4E00\u4EFD\u6B63\u6587\u53EA\u662F\u53E6\u4E00\u4EFD\u6B63\u6587\u7684\u524D\u7F00", metrics);
    }
    if (contentCoverage.left < MIN_CONTENT_COVERAGE || contentCoverage.right < MIN_CONTENT_COVERAGE) {
      return resultWithMetrics(false, "\u4E24\u4EFD\u6B63\u6587\u7684\u53CC\u5411\u5185\u5BB9\u8986\u76D6\u4E0D\u8DB3", metrics);
    }
    if (metrics.apiOrderCoverage < MIN_ORDER_COVERAGE || metrics.pageOrderCoverage < MIN_ORDER_COVERAGE) {
      return resultWithMetrics(false, "\u4E24\u4EFD\u6B63\u6587\u7684\u5185\u5BB9\u987A\u5E8F\u4E0D\u4E00\u81F4", metrics);
    }
    if (boundary.start < MIN_BOUNDARY_COVERAGE || boundary.end < MIN_BOUNDARY_COVERAGE) {
      return resultWithMetrics(false, "\u4E24\u4EFD\u6B63\u6587\u7684\u5F00\u5934\u6216\u7ED3\u5C3E\u4E0D\u4E00\u81F4", metrics);
    }
    return resultWithMetrics(true, "\u6B63\u6587\u5185\u5BB9\u4E00\u81F4\uFF0C\u4EC5\u5B58\u5728\u53EF\u63A5\u53D7\u7684\u5C55\u793A\u5DEE\u5F02", { ...metrics, kind: "acceptable" });
  }
  function formatArticleMatchDiagnostics(result) {
    const percentage = (value) => `${(Number(value || 0) * 100).toFixed(2)}%`;
    return [
      `\u63A5\u53E3 ${Number(result?.apiLength || 0)} \u5B57`,
      `\u9875\u9762 ${Number(result?.pageLength || 0)} \u5B57`,
      `\u957F\u5EA6\u6BD4 ${percentage(result?.lengthRatio)}`,
      `\u5185\u5BB9\u8986\u76D6 ${percentage(result?.apiCoverage)}/${percentage(result?.pageCoverage)}`,
      `\u987A\u5E8F\u8986\u76D6 ${percentage(result?.apiOrderCoverage)}/${percentage(result?.pageOrderCoverage)}`,
      `\u9996\u5C3E\u8986\u76D6 ${percentage(result?.startCoverage)}/${percentage(result?.endCoverage)}`
    ].join("\uFF0C");
  }

  // src/export-plan.js
  var PAGE_MODE_MS_PER_ARTICLE = 2600;
  var PAGE_MODE_TAB_COUNT = 4;
  var MAX_CONSECUTIVE_PAGE_FAILURES = 10;
  var MIN_SAMPLES_FOR_ESTIMATE = 3;
  var PAGE_MODE_SUFFIX = "\u5DF2\u81EA\u52A8\u6539\u7528\u9010\u7BC7\u9875\u9762\u63D0\u53D6";
  function pageModeTabCount(count, limit = PAGE_MODE_TAB_COUNT) {
    const total = Math.max(0, Math.floor(Number(count) || 0));
    const cap = Math.max(1, Math.floor(Number(limit) || PAGE_MODE_TAB_COUNT));
    return Math.max(1, Math.min(cap, total));
  }
  function formatDuration(milliseconds) {
    const totalSeconds = Math.max(0, Number(milliseconds) || 0) / 1e3;
    if (totalSeconds < 60) return `${Math.max(1, Math.round(totalSeconds))} \u79D2`;
    const totalMinutes = Math.round(totalSeconds / 60);
    if (totalMinutes < 60) return `${Math.max(1, totalMinutes)} \u5206\u949F`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes ? `${hours} \u5C0F\u65F6 ${minutes} \u5206\u949F` : `${hours} \u5C0F\u65F6`;
  }
  function estimatePageModeDuration(count, msPerArticle = PAGE_MODE_MS_PER_ARTICLE, tabCount = PAGE_MODE_TAB_COUNT) {
    const total = Math.max(0, Math.floor(Number(count) || 0));
    const perArticle = Math.max(0, Number(msPerArticle) || 0);
    return Math.round(total * perArticle / pageModeTabCount(total, tabCount));
  }
  function remainingTimeText(elapsedMs, processed, remaining) {
    const done = Math.floor(Number(processed) || 0);
    const left = Math.floor(Number(remaining) || 0);
    if (done < MIN_SAMPLES_FOR_ESTIMATE || left <= 0) return "";
    const perArticle = (Number(elapsedMs) || 0) / done;
    if (!Number.isFinite(perArticle) || perArticle <= 0) return "";
    return `\u9884\u8BA1\u8FD8\u9700 ${formatDuration(perArticle * left)}`;
  }
  function pageModeAnnouncement(count, msPerArticle = PAGE_MODE_MS_PER_ARTICLE, tabCount = PAGE_MODE_TAB_COUNT) {
    const total = Math.max(0, Math.floor(Number(count) || 0));
    if (!total) return "\u6CA1\u6709\u9700\u8981\u9010\u7BC7\u63D0\u53D6\u7684\u6587\u7AE0";
    const tabs = pageModeTabCount(total, tabCount);
    const duration = formatDuration(estimatePageModeDuration(total, msPerArticle, tabs));
    return `\u5F00\u59CB\u9010\u7BC7\u9875\u9762\u63D0\u53D6\uFF0C\u5171 ${total} \u7BC7\uFF0C\u9884\u8BA1 ${duration}\uFF1B\u5168\u7A0B\u4F7F\u7528 ${tabs} \u4E2A\u540E\u53F0\u6807\u7B7E\u9875\u5E76\u884C\uFF0C\u53EF\u968F\u65F6\u505C\u6B62\u5E76\u4FDD\u5B58\u5DF2\u5B8C\u6210\u90E8\u5206`;
  }
  function describeArticleMismatch(comparison) {
    const kind = String(comparison?.kind || "different");
    const apiLength = Number(comparison?.apiLength || 0);
    const pageLength = Number(comparison?.pageLength || 0);
    if (kind === "apiTruncated") {
      const percent = pageLength ? Math.round(apiLength / pageLength * 100) : 0;
      return `\u77E5\u4E4E\u6587\u7AE0\u63A5\u53E3\u53EA\u8FD4\u56DE\u8BD5\u770B\u6B63\u6587\uFF0C\u4EC5\u4E3A\u9875\u9762\u6B63\u6587\u7684 ${percent}%\uFF08\u63A5\u53E3 ${apiLength} \u5B57\uFF0C\u9875\u9762 ${pageLength} \u5B57\uFF09`;
    }
    if (kind === "pageTruncated") {
      return `\u6B63\u5E38\u6587\u7AE0\u9875\u5F53\u524D\u663E\u793A\u7684\u6B63\u6587\u6BD4\u63A5\u53E3\u66F4\u77ED\uFF08\u9875\u9762 ${pageLength} \u5B57\uFF0C\u63A5\u53E3 ${apiLength} \u5B57\uFF09`;
    }
    if (kind === "tooShort") {
      return `\u63A5\u53E3\u4E0E\u9875\u9762\u6B63\u6587\u90FD\u8FC7\u77ED\uFF0C\u65E0\u6CD5\u786E\u8BA4\u5B8C\u6574\u6027\uFF08\u63A5\u53E3 ${apiLength} \u5B57\uFF0C\u9875\u9762 ${pageLength} \u5B57\uFF09`;
    }
    if (kind === "unavailable") {
      return String(comparison?.reason || "\u63A5\u53E3\u6216\u6B63\u5E38\u6587\u7AE0\u9875\u6CA1\u6709\u63D0\u53D6\u5230\u6B63\u6587");
    }
    return `\u6587\u7AE0\u63A5\u53E3\u6B63\u6587\u4E0E\u6B63\u5E38\u6587\u7AE0\u9875\u4E0D\u4E00\u81F4\uFF1A${comparison?.reason || "\u5185\u5BB9\u4E0D\u540C"}`;
  }
  function mismatchDetail(comparison) {
    const diagnostics = formatArticleMatchDiagnostics(comparison);
    const sample = String(comparison?.missingSample || "");
    return sample ? `${diagnostics}\uFF1B\u9875\u9762\u72EC\u6709\u7247\u6BB5\uFF1A${sample}` : diagnostics;
  }
  function planArticleSource({ probeFailure = "", comparison = null } = {}) {
    if (probeFailure) {
      return {
        mode: "page",
        headline: `\u767B\u5F55\u6001\u6587\u7AE0\u63A5\u53E3\u4E0D\u53EF\u7528\uFF1A${probeFailure}\uFF1B${PAGE_MODE_SUFFIX}`,
        detail: ""
      };
    }
    if (!comparison) {
      return {
        mode: "page",
        headline: `\u6CA1\u6709\u5B8C\u6210\u6587\u7AE0\u63A5\u53E3\u6B63\u6587\u6821\u9A8C\uFF1B${PAGE_MODE_SUFFIX}`,
        detail: ""
      };
    }
    if (comparison.matches) {
      return {
        mode: "api",
        headline: "\u767B\u5F55\u6001\u6587\u7AE0\u63A5\u53E3\u5DF2\u901A\u8FC7\u6743\u9650\u4E0E\u6B63\u6587\u4E00\u81F4\u6027\u6821\u9A8C",
        detail: formatArticleMatchDiagnostics(comparison)
      };
    }
    return {
      mode: "page",
      headline: `${describeArticleMismatch(comparison)}\uFF1B${PAGE_MODE_SUFFIX}`,
      detail: mismatchDetail(comparison)
    };
  }
  function shouldStopPageMode(consecutiveFailures, limit = MAX_CONSECUTIVE_PAGE_FAILURES) {
    const failures = Math.floor(Number(consecutiveFailures) || 0);
    const threshold = Math.max(1, Math.floor(Number(limit) || MAX_CONSECUTIVE_PAGE_FAILURES));
    return failures >= threshold;
  }
  function pageModeStopMessage(consecutiveFailures, savedCount) {
    return `\u8FDE\u7EED ${Math.floor(Number(consecutiveFailures) || 0)} \u7BC7\u9875\u9762\u63D0\u53D6\u5931\u8D25\uFF0C\u5DF2\u505C\u6B62\u4EE5\u907F\u514D\u7EE7\u7EED\u65E0\u6548\u8BF7\u6C42\uFF1B\u5DF2\u5B8C\u6210\u7684 ${Math.floor(Number(savedCount) || 0)} \u7BC7\u4F1A\u4FDD\u5B58\u5230\u538B\u7F29\u5305`;
  }

  // src/page-identity.js
  function expectedPageFromUrl(url) {
    const parsed = parsePaidColumnUrl(url);
    return {
      url: new URL(url).href,
      kind: parsed?.kind || null,
      columnId: parsed?.columnId || null,
      sectionId: parsed?.sectionId || null
    };
  }
  function pageMatchesExpectation(actualUrl, expected) {
    const actual = parsePaidColumnUrl(actualUrl);
    if (expected?.kind === "section" && expected.sectionId) {
      return actual?.kind === "section" && actual.sectionId === expected.sectionId && (!expected.columnId || actual.columnId === expected.columnId);
    }
    if (expected?.kind === "catalog" && expected.columnId) {
      return actual?.kind === "catalog" && actual.columnId === expected.columnId;
    }
    try {
      const actual2 = new URL(actualUrl);
      const target = new URL(expected?.url || "");
      return actual2.origin === target.origin && actual2.pathname.replace(/\/+$/, "") === target.pathname.replace(/\/+$/, "");
    } catch {
      return false;
    }
  }
  function assertExpectedArticleResult(result, expectedSectionId, expectedColumnId = null) {
    if (result?.ok && String(result.sectionId || "") !== String(expectedSectionId || "")) {
      throw new Error(`\u6B63\u6587\u8EAB\u4EFD\u4E0D\u5339\u914D\uFF1A\u9884\u671F\u6587\u7AE0 ${expectedSectionId}\uFF0C\u5B9E\u9645\u8FD4\u56DE ${result.sectionId || "\u672A\u77E5"}`);
    }
    if (result?.ok && expectedColumnId && String(result.columnId || "") !== String(expectedColumnId)) {
      throw new Error(`\u6B63\u6587\u4E13\u680F\u4E0D\u5339\u914D\uFF1A\u9884\u671F\u4E13\u680F ${expectedColumnId}\uFF0C\u5B9E\u9645\u8FD4\u56DE ${result.columnId || "\u672A\u77E5"}`);
    }
    return result;
  }

  // src/tab-lifecycle.js
  async function waitForStableTab({
    tabId,
    getTab,
    wait,
    now = Date.now,
    timeoutMs = 45e3,
    stableMs = 300,
    pollMs = 100,
    requireComplete = false
  }) {
    const deadline = now() + timeoutMs;
    let stableSince = null;
    let previousUrl = "";
    while (now() < deadline) {
      const tab = await getTab(tabId);
      const currentUrl = tab.url || "";
      const loaded = requireComplete ? tab.status === "complete" : Boolean(currentUrl);
      if (loaded && currentUrl === previousUrl) {
        if (stableSince === null) stableSince = now();
        if (now() - stableSince >= stableMs) return tab;
      } else {
        stableSince = null;
        previousUrl = currentUrl;
      }
      await wait(pollMs);
    }
    throw new Error("\u9875\u9762\u52A0\u8F7D\u540E\u672A\u80FD\u7A33\u5B9A\u4E0B\u6765");
  }
  async function waitForExpectedTabUrl({
    tabId,
    expectedPage,
    getTab,
    wait,
    now = Date.now,
    timeoutMs = 2e4,
    pollMs = 100
  }) {
    const deadline = now() + timeoutMs;
    let lastUrl = "";
    while (now() < deadline) {
      const tab = await getTab(tabId);
      lastUrl = tab.url || "";
      if (lastUrl && pageMatchesExpectation(lastUrl, expectedPage)) return tab;
      await wait(pollMs);
    }
    return { id: tabId, url: lastUrl, matched: false };
  }
  async function ensureExpectedTabPage({
    tabId,
    expectedPage,
    waitForStable,
    updateTab
  }) {
    let tab = await waitForStable(tabId);
    if (pageMatchesExpectation(tab.url || "", expectedPage)) return tab;
    await updateTab(tabId, { url: expectedPage.url });
    tab = await waitForStable(tabId);
    if (!pageMatchesExpectation(tab.url || "", expectedPage)) {
      throw new Error("\u6587\u7AE0\u6807\u7B7E\u9875\u8DF3\u8F6C\u540E\u672A\u80FD\u6062\u590D\u5230\u76EE\u6807\u9875\u9762");
    }
    return tab;
  }

  // src/exporter.js
  var PAGE_READY_ATTEMPTS = 200;
  var PAGE_READY_INTERVAL_MS = 100;
  var PAGE_READY_STABLE_MS = 300;
  var PAGE_READY_EMPTY_LIMIT = 80;
  var ui = {
    sourceBadge: document.querySelector("#source-badge"),
    columnTitle: document.querySelector("#column-title"),
    sourceUrl: document.querySelector("#source-url"),
    stateLabel: document.querySelector("#state-label"),
    currentItem: document.querySelector("#current-item"),
    progress: document.querySelector("#progress"),
    foundCount: document.querySelector("#found-count"),
    savedCount: document.querySelector("#saved-count"),
    failedCount: document.querySelector("#failed-count"),
    log: document.querySelector("#activity-log"),
    error: document.querySelector("#error-message"),
    start: document.querySelector("#start-button"),
    stop: document.querySelector("#stop-button"),
    retry: document.querySelector("#retry-button"),
    saveAgain: document.querySelector("#save-again-button"),
    markdown: document.querySelector("#format-markdown"),
    html: document.querySelector("#format-html"),
    images: document.querySelector("#include-images")
  };
  createIcons({
    icons: { AlertTriangle: TriangleAlert, BookDown, CheckCircle2: CircleCheck, Download, FileArchive, LoaderCircle, RotateCcw, Square }
  });
  var query = new URLSearchParams(location.search);
  var sourceTabId = query.has("tabId") ? Number(query.get("tabId")) : NaN;
  var sourceTab = null;
  var activeTempTabIds = /* @__PURE__ */ new Set();
  var lastArchive = null;
  var session = freshSession();
  async function closeTempTab(tabId) {
    if (!Number.isInteger(tabId)) return;
    activeTempTabIds.delete(tabId);
    try {
      await chrome.tabs.remove(tabId);
    } catch {
    }
  }
  function freshSession() {
    return {
      running: false,
      cancelled: false,
      columnId: null,
      columnTitle: "\u77E5\u4E4E\u4ED8\u8D39\u4E13\u680F",
      sourceUrl: "",
      articles: [],
      failures: [],
      imageFailures: [],
      knownLinks: [],
      catalogComplete: null,
      expectedArticleCount: null,
      articleApiTabId: null,
      articleApiValidated: false,
      articleApiOrigin: null,
      articleSourceMode: null,
      completedIds: /* @__PURE__ */ new Set()
    };
  }
  function setState(label, current = "") {
    ui.stateLabel.textContent = label;
    ui.currentItem.textContent = current;
  }
  function setError(message = "") {
    ui.error.hidden = !message;
    ui.error.textContent = message;
  }
  function setRunning(running) {
    session.running = running;
    ui.start.disabled = running;
    ui.stop.hidden = !running;
    ui.retry.disabled = running;
    ui.saveAgain.disabled = running;
    document.body.classList.toggle("is-running", running);
  }
  function updateMetrics(total = session.expectedArticleCount ?? session.knownLinks.length, done = session.articles.length + session.failures.length) {
    ui.foundCount.textContent = String(total);
    ui.savedCount.textContent = String(session.articles.length);
    ui.failedCount.textContent = String(session.failures.length);
    ui.progress.max = Math.max(total, 1);
    ui.progress.value = Math.min(done, Math.max(total, 1));
  }
  function addLog(message, tone = "neutral") {
    const item = document.createElement("li");
    item.className = `log-item log-${tone}`;
    item.textContent = message;
    ui.log.prepend(item);
    while (ui.log.children.length > 40) ui.log.lastElementChild.remove();
  }
  function trimTabTitle(value) {
    return String(value || "").replace(/\s*[-–|]\s*知乎\s*$/, "").trim();
  }
  async function initialize() {
    try {
      if (!Number.isInteger(sourceTabId) || sourceTabId <= 0) throw new Error("\u6CA1\u6709\u627E\u5230\u6765\u6E90\u9875\u9762\uFF0C\u8BF7\u4ECE\u77E5\u4E4E\u9875\u9762\u70B9\u51FB\u6269\u5C55\u56FE\u6807\u6253\u5F00");
      sourceTab = await chrome.tabs.get(sourceTabId);
      if (!isZhihuUrl(sourceTab.url || "")) {
        throw new Error("\u8BF7\u5148\u6253\u5F00\u77E5\u4E4E\u4ED8\u8D39\u4E13\u680F\u7684\u76EE\u5F55\u9875\u6216\u4EFB\u4E00\u7AE0\u8282\u9875\uFF0C\u518D\u70B9\u51FB\u6269\u5C55\u56FE\u6807");
      }
      const parsed = parsePaidColumnUrl(sourceTab.url || "");
      session.columnId = parsed?.columnId || null;
      session.columnTitle = trimTabTitle(sourceTab.title) || "\u77E5\u4E4E\u4ED8\u8D39\u4E13\u680F";
      session.sourceUrl = sourceTab.url;
      ui.columnTitle.textContent = session.columnTitle;
      ui.sourceUrl.textContent = session.sourceUrl;
      ui.sourceUrl.href = session.sourceUrl;
      ui.sourceBadge.dataset.state = "ready";
      ui.sourceBadge.textContent = "\u9875\u9762\u5DF2\u8BC6\u522B";
      ui.start.disabled = false;
      setState("\u51C6\u5907\u5C31\u7EEA", "");
    } catch (error) {
      ui.sourceBadge.dataset.state = "error";
      ui.sourceBadge.textContent = "\u672A\u8BC6\u522B\u9875\u9762";
      ui.columnTitle.textContent = "\u672A\u8BFB\u53D6\u5230\u4E13\u680F";
      ui.start.disabled = true;
      setState("\u65E0\u6CD5\u5F00\u59CB", "");
      setError(error.message || String(error));
    }
  }
  async function waitForTabStable(tabId, timeoutMs = 45e3, stableMs = 300) {
    return waitForStableTab({
      tabId,
      getTab: (id) => chrome.tabs.get(id),
      wait: sleep,
      timeoutMs,
      stableMs
    });
  }
  async function ensureContentScript(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "PING" });
    } catch {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      await sleep(250);
    }
  }
  async function ensureExpectedPage(tabId, expectedPage) {
    return ensureExpectedTabPage({
      tabId,
      expectedPage,
      waitForStable: waitForTabStable,
      updateTab: (id, update) => chrome.tabs.update(id, update)
    });
  }
  async function sendToTab(tabId, message, expectedPage) {
    const attempts = 2;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      await ensureContentScript(tabId);
      try {
        return await chrome.tabs.sendMessage(tabId, message);
      } catch (error) {
        if (!isMessageChannelClosed(error)) throw error;
        if (attempt === attempts) throw messageChannelClosedError();
        await ensureExpectedPage(tabId, expectedPage);
      }
    }
    throw new Error("\u6B63\u6587\u63D0\u53D6\u6D88\u606F\u672A\u8FD4\u56DE\u7ED3\u679C");
  }
  async function sendToArticleApiTab(message) {
    const tab = await chrome.tabs.get(session.articleApiTabId);
    const expectedPage = expectedPageFromUrl(session.sourceUrl);
    if (!pageMatchesExpectation(tab.url || "", expectedPage)) {
      throw new Error("\u4E13\u680F\u6765\u6E90\u9875\u5DF2\u53D1\u751F\u53D8\u5316\uFF0C\u767B\u5F55\u6001\u6587\u7AE0\u63A5\u53E3\u4E0D\u53EF\u7EE7\u7EED\u4F7F\u7528");
    }
    await ensureContentScript(tab.id);
    return chrome.tabs.sendMessage(tab.id, message);
  }
  async function visitPage(url, messageType) {
    const tab = await chrome.tabs.create({ url, active: false });
    const expectedPage = expectedPageFromUrl(url);
    activeTempTabIds.add(tab.id);
    try {
      await ensureExpectedPage(tab.id, expectedPage);
      if (session.cancelled) throw new Error("\u5BFC\u51FA\u5DF2\u505C\u6B62");
      return await sendToTab(tab.id, { type: messageType }, expectedPage);
    } finally {
      await closeTempTab(tab.id);
    }
  }
  function addKnownLinks(links) {
    const merged = uniqueBy([...session.knownLinks, ...links || []], (item) => item.sectionId);
    session.knownLinks = merged;
    updateMetrics();
  }
  function nextQueue() {
    return session.knownLinks.filter((link) => !session.completedIds.has(link.sectionId));
  }
  async function discoverCatalog() {
    setState("\u6B63\u5728\u8BFB\u53D6\u76EE\u5F55", "\u7B49\u5F85\u77E5\u4E4E\u52A0\u8F7D\u5B8C\u6574\u7AE0\u8282\u5217\u8868");
    const candidateUrls = [];
    if (/^c_\d+$/.test(String(session.columnId || ""))) {
      candidateUrls.push(`https://www.zhihu.com/column/${session.columnId}`);
    }
    candidateUrls.push(session.sourceUrl);
    let result = null;
    let retainedApiTabId = null;
    let lastError = null;
    for (const candidateUrl of uniqueBy(candidateUrls, (url) => url)) {
      try {
        const expectedPage = expectedPageFromUrl(candidateUrl);
        const currentSourceTab = await chrome.tabs.get(sourceTabId);
        const useSourceTab = pageMatchesExpectation(currentSourceTab.url || "", expectedPage);
        result = await retryOperation(async () => {
          const discovery = useSourceTab ? await (async () => {
            await ensureExpectedPage(sourceTabId, expectedPage);
            return sendToTab(sourceTabId, { type: "DISCOVER_COLUMN" }, expectedPage);
          })() : await visitPage(candidateUrl, "DISCOVER_COLUMN");
          if (!discovery?.ok) throw new Error(discovery?.reason || "\u672A\u80FD\u8BFB\u53D6\u4E13\u680F\u76EE\u5F55");
          if (discovery.catalogComplete === false) {
            throw new Error(discovery.discoveryError || "\u76EE\u5F55\u63A5\u53E3\u672A\u8FD4\u56DE\u5B8C\u6574\u7ED3\u679C");
          }
          return discovery;
        }, {
          attempts: 3,
          shouldRetry: () => !session.cancelled,
          onRetry: ({ error, nextAttempt }) => {
            addLog(`\u76EE\u5F55\u8BFB\u53D6\u5931\u8D25\uFF1A${error.message || error}\uFF1B\u6B63\u5728\u81EA\u52A8\u91CD\u8BD5 ${nextAttempt} / 3`, "neutral");
          }
        });
        if (useSourceTab && result.articleApiAvailable === true) retainedApiTabId = sourceTabId;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!result) throw lastError || new Error("\u672A\u80FD\u8BFB\u53D6\u4E13\u680F\u76EE\u5F55");
    session.columnId = result.columnId;
    session.columnTitle = trimTabTitle(result.columnTitle) || session.columnTitle;
    session.catalogComplete = result.catalogComplete;
    session.expectedArticleCount = Number.isSafeInteger(result.expectedCount) ? result.expectedCount : null;
    session.articleApiTabId = retainedApiTabId;
    session.articleApiValidated = false;
    session.articleApiOrigin = null;
    session.articleSourceMode = null;
    ui.columnTitle.textContent = session.columnTitle;
    addKnownLinks(result.links);
    if (result.catalogComplete === false) {
      const detail = result.discoveryError ? `\uFF1A${result.discoveryError}` : "";
      throw new Error(`\u672A\u80FD\u8BFB\u53D6\u5B8C\u6574\u4E13\u680F\u76EE\u5F55${detail}`);
    }
    if (!session.knownLinks.length && result.sectionId) {
      addKnownLinks([{
        sectionId: result.sectionId,
        title: trimTabTitle(sourceTab.title) || `\u7AE0\u8282 ${result.sectionId}`,
        url: session.sourceUrl
      }]);
    }
    if (!session.knownLinks.length) {
      throw new Error("\u9875\u9762\u4E2D\u6CA1\u6709\u53D1\u73B0\u7AE0\u8282\u3002\u8BF7\u6253\u5F00\u8BE5\u4E13\u680F\u7684\u4EFB\u4E00\u6B63\u6587\u9875\uFF0C\u518D\u70B9\u51FB\u6269\u5C55\u56FE\u6807");
    }
    addLog(`\u5DF2\u53D1\u73B0 ${session.knownLinks.length} \u7BC7\u7AE0\u8282`, "success");
    if (session.articleApiTabId) addLog("\u5DF2\u51C6\u5907\u767B\u5F55\u6001\u6279\u91CF\u6B63\u6587\u63A5\u53E3\uFF0C\u5F00\u59CB\u524D\u5C06\u6821\u9A8C\u8D26\u53F7\u6743\u9650\u4E0E\u6B63\u6587\u5B8C\u6574\u6027", "success");
  }
  async function navigateToArticle(tabId, link) {
    const expectedPage = expectedPageFromUrl(link.url);
    await chrome.tabs.update(tabId, { url: expectedPage.url });
    const tab = await waitForExpectedTabUrl({
      tabId,
      expectedPage,
      getTab: (id) => chrome.tabs.get(id),
      wait: sleep
    });
    if (tab?.matched === false) {
      await ensureExpectedPage(tabId, expectedPage);
    }
    return expectedPage;
  }
  async function extractSettledArticle(tabId, link, expectedPage) {
    let lastSectionId = "";
    const settle = await settleFingerprint({
      sample: async () => {
        if (session.cancelled) throw new Error("\u5BFC\u51FA\u5DF2\u505C\u6B62");
        const probe = await sendToTab(tabId, { type: "PROBE_ARTICLE" }, expectedPage);
        lastSectionId = String(probe?.sectionId || "");
        if (lastSectionId && lastSectionId !== String(link.sectionId)) return "";
        return String(probe?.fingerprint || "");
      },
      wait: sleep,
      attempts: PAGE_READY_ATTEMPTS,
      intervalMs: PAGE_READY_INTERVAL_MS,
      stableSamples: 3,
      minimumStableMs: PAGE_READY_STABLE_MS,
      emptyLimit: PAGE_READY_EMPTY_LIMIT
    });
    if (!settle.settled && !settle.fingerprint) {
      await ensureExpectedPage(tabId, expectedPage);
    }
    return assertExpectedArticleResult(
      await sendToTab(tabId, { type: "EXTRACT_ARTICLE", settled: settle.settled }, expectedPage),
      link.sectionId
    );
  }
  async function extractOneArticle(tabId, link) {
    return retryOperation(async () => {
      if (session.cancelled) throw new Error("\u5BFC\u51FA\u5DF2\u505C\u6B62");
      const expectedPage = await navigateToArticle(tabId, link);
      const result = await extractSettledArticle(tabId, link, expectedPage);
      if (!result?.ok && !result?.accessDenied) {
        throw new Error(result?.reason || "\u6B63\u6587\u63D0\u53D6\u5931\u8D25");
      }
      addKnownLinks(result?.discovered);
      return result;
    }, {
      attempts: 3,
      shouldRetry: () => !session.cancelled,
      onRetry: ({ error, nextAttempt }) => {
        addLog(`${link.title}\uFF1A${error.message}\uFF0C\u6B63\u5728\u81EA\u52A8\u91CD\u8BD5 ${nextAttempt} / 3`, "neutral");
      }
    });
  }
  async function processPageQueue(queue, includeDiscovered = true) {
    const claimedIds = /* @__PURE__ */ new Set();
    const scope = () => (includeDiscovered ? nextQueue() : queue).filter((link) => !session.completedIds.has(link.sectionId));
    const pending = () => scope().filter((link) => !claimedIds.has(link.sectionId));
    const initial = scope();
    if (!initial.length || session.cancelled) return;
    const startedAt = Date.now();
    let processed = 0;
    let consecutiveFailures = 0;
    let stopReason = null;
    const tabCount = pageModeTabCount(initial.length);
    addLog(pageModeAnnouncement(initial.length), "neutral");
    const takeNext = () => {
      const next = pending()[0];
      if (next) claimedIds.add(next.sectionId);
      return next;
    };
    const runWorker = async (tabId) => {
      for (let link = takeNext(); link; link = takeNext()) {
        if (session.cancelled || stopReason) return;
        const position = session.completedIds.size + 1;
        const total = Math.max(session.expectedArticleCount ?? session.knownLinks.length, position);
        const eta = remainingTimeText(Date.now() - startedAt, processed, scope().length);
        setState("\u6B63\u5728\u9010\u7BC7\u63D0\u53D6\u6B63\u6587", `${position} / ${total} \xB7 ${link.title}${eta ? ` \xB7 ${eta}` : ""}`);
        try {
          const article = await extractOneArticle(tabId, link);
          if (!article?.ok) {
            recordFailure(link, article?.reason || "\u6B63\u6587\u63D0\u53D6\u5931\u8D25", Boolean(article?.accessDenied));
            consecutiveFailures += 1;
            if (article?.accessDenied && session.articles.length === 0) {
              stopReason = new Error("\u5F53\u524D Chrome \u4F1A\u8BDD\u6CA1\u6709\u663E\u793A\u5B8C\u6574\u6B63\u6587\u3002\u8BF7\u786E\u8BA4\u8FD9\u4E2A\u6D4F\u89C8\u5668\u914D\u7F6E\u5DF2\u767B\u5F55\u5E76\u5DF2\u8BA2\u9605\u8BE5\u4E13\u680F");
              return;
            }
          } else {
            storeSuccessfulArticle(link, article);
            addKnownLinks(article.discovered);
            consecutiveFailures = 0;
          }
        } catch (error) {
          if (session.cancelled) return;
          if (/当前 Chrome 会话没有显示完整正文/.test(error.message || "")) {
            stopReason = error;
            return;
          }
          recordFailure(link, error.message || String(error));
          consecutiveFailures += 1;
        }
        processed += 1;
        updateMetrics();
        if (shouldStopPageMode(consecutiveFailures)) {
          stopReason = new Error(pageModeStopMessage(consecutiveFailures, session.articles.length));
          return;
        }
      }
    };
    const tabs = [];
    try {
      for (let index = 0; index < tabCount; index += 1) {
        const tab = await chrome.tabs.create({ url: "about:blank", active: false });
        activeTempTabIds.add(tab.id);
        tabs.push(tab.id);
      }
      await Promise.all(tabs.map((tabId) => runWorker(tabId)));
    } finally {
      await Promise.all(tabs.map((tabId) => closeTempTab(tabId)));
    }
    if (stopReason) throw stopReason;
  }
  function recordFailure(link, reason, accessDenied = false) {
    if (session.completedIds.has(link.sectionId)) return;
    session.failures.push({
      sectionId: link.sectionId,
      title: link.title,
      url: link.url,
      reason,
      accessDenied
    });
    session.completedIds.add(link.sectionId);
    addLog(`${link.title}\uFF1A${reason}`, "error");
  }
  function storeSuccessfulArticle(link, article) {
    assertExpectedArticleResult(article, link.sectionId);
    if (!article?.ok) throw new Error(article?.reason || "\u6B63\u6587\u63D0\u53D6\u5931\u8D25");
    session.articles.push(article);
    session.completedIds.add(link.sectionId);
    addLog(article.title, "success");
  }
  async function probeArticleApiAccess(probeLink) {
    const probe = await retryOperation(async () => {
      const result = await sendToArticleApiTab({
        type: "PROBE_ARTICLE_API",
        columnId: session.columnId,
        sectionId: probeLink.sectionId
      });
      if (!result?.ok) {
        const error = new Error(result?.reason || "\u767B\u5F55\u6001\u6587\u7AE0\u63A5\u53E3\u4E0D\u53EF\u7528");
        error.accessDenied = Boolean(result?.accessDenied);
        error.truncated = Boolean(result?.truncated);
        throw error;
      }
      return result;
    }, {
      attempts: 2,
      shouldRetry: (error) => !session.cancelled && !error.accessDenied && !error.truncated,
      onRetry: ({ error }) => addLog(`\u6587\u7AE0\u63A5\u53E3\u6821\u9A8C\u5931\u8D25\uFF1A${error.message}\uFF1B\u6B63\u5728\u91CD\u8BD5`, "neutral")
    });
    if (!probe.anonymousDenied) throw new Error("\u65E0\u6CD5\u8BC1\u660E\u6587\u7AE0\u63A5\u53E3\u53EA\u5411\u5F53\u524D\u767B\u5F55\u4F1A\u8BDD\u8FD4\u56DE\u6B63\u6587");
    return probe;
  }
  async function readProbePage(probeLink) {
    return retryOperation(async () => {
      const result = assertExpectedArticleResult(
        await visitPage(probeLink.url, "EXTRACT_ARTICLE"),
        probeLink.sectionId,
        session.columnId
      );
      if (!result?.ok) {
        const error = new Error(result?.reason || "\u6B63\u5E38\u6587\u7AE0\u9875\u6CA1\u6709\u8FD4\u56DE\u5B8C\u6574\u6B63\u6587");
        error.accessDenied = Boolean(result?.accessDenied);
        throw error;
      }
      return result;
    }, {
      attempts: 2,
      shouldRetry: (error) => !session.cancelled && !error.accessDenied
    });
  }
  async function decideArticleSource(queue) {
    const probeLink = queue.find((link) => link.requiresAccessProbe) || queue[0];
    if (!probeLink) return planArticleSource({ probeFailure: "\u6CA1\u6709\u53EF\u7528\u4E8E\u6743\u9650\u6821\u9A8C\u7684\u6587\u7AE0" });
    setState("\u6B63\u5728\u6821\u9A8C\u9605\u8BFB\u6743\u9650", probeLink.title);
    let probe = null;
    try {
      probe = await probeArticleApiAccess(probeLink);
    } catch (error) {
      return planArticleSource({ probeFailure: error.message || String(error) });
    }
    let apiArticle = null;
    let pageArticle = null;
    try {
      apiArticle = assertExpectedArticleResult(probe.article, probeLink.sectionId, session.columnId);
      pageArticle = await readProbePage(probeLink);
    } catch (error) {
      return planArticleSource({ probeFailure: error.message || String(error) });
    }
    const plan = planArticleSource({ comparison: compareArticleApiWithPage(apiArticle, pageArticle) });
    return { ...plan, apiOrigin: probe.apiOrigin };
  }
  async function processArticleApiQueue(queue) {
    const pending = queue.filter((link) => !session.completedIds.has(link.sectionId));
    if (!pending.length) return;
    if (session.articleSourceMode === "page") return processPageQueue(pending);
    if (session.articleSourceMode !== "api") {
      const plan = await decideArticleSource(pending);
      addLog(plan.headline, plan.mode === "api" ? "success" : "neutral");
      if (plan.detail) addLog(plan.detail, "neutral");
      session.articleSourceMode = plan.mode;
      if (plan.mode !== "api") return processPageQueue(pending);
      session.articleApiValidated = true;
      session.articleApiOrigin = plan.apiOrigin;
    }
    const batchSize = 12;
    const pageFallback = [];
    for (let offset = 0; offset < pending.length && !session.cancelled; offset += batchSize) {
      const batch = pending.slice(offset, offset + batchSize);
      setState("\u6B63\u5728\u6279\u91CF\u5BFC\u51FA", `${Math.min(offset + batch.length, pending.length)} / ${pending.length}`);
      let ordered;
      try {
        ordered = await retryOperation(async () => {
          const response = await sendToArticleApiTab({
            type: "EXTRACT_API_ARTICLES",
            columnId: session.columnId,
            apiOrigin: session.articleApiOrigin,
            sectionIds: batch.map((link) => link.sectionId)
          });
          return validateArticleBatchResponse(response, batch.map((link) => link.sectionId));
        }, {
          attempts: 2,
          shouldRetry: () => !session.cancelled,
          onRetry: ({ error }) => addLog(`\u6279\u91CF\u6B63\u6587\u8BFB\u53D6\u5931\u8D25\uFF1A${error.message || error}\uFF1B\u6B63\u5728\u91CD\u8BD5`, "neutral")
        });
      } catch (error) {
        const remaining = pending.slice(offset).filter((link) => !session.completedIds.has(link.sectionId));
        const unresolved = uniqueBy([...pageFallback, ...remaining], (link) => link.sectionId).filter((link) => !session.completedIds.has(link.sectionId));
        session.articleSourceMode = "page";
        addLog(`\u767B\u5F55\u6001\u6587\u7AE0\u63A5\u53E3\u4E2D\u65AD\uFF1A${error.message || error}\uFF1B\u5269\u4F59 ${unresolved.length} \u7BC7\u6539\u7528\u9010\u7BC7\u9875\u9762\u63D0\u53D6`, "neutral");
        return processPageQueue(unresolved, false);
      }
      for (let index = 0; index < batch.length; index += 1) {
        const link = batch[index];
        const article = ordered[index];
        if (!article?.ok) {
          pageFallback.push({ ...link, apiFailureReason: article?.reason || "\u6587\u7AE0\u63A5\u53E3\u6CA1\u6709\u8FD4\u56DE\u6B63\u6587" });
          continue;
        }
        try {
          storeSuccessfulArticle(link, article);
        } catch (error) {
          pageFallback.push({ ...link, apiFailureReason: error.message || String(error) });
        }
        updateMetrics();
      }
      await sleep(80);
    }
    if (!pageFallback.length || session.cancelled) return;
    addLog(`${pageFallback.length} \u7BC7\u63A5\u53E3\u6B63\u6587\u4E0D\u53EF\u7528\uFF0C\u6539\u7528\u9010\u7BC7\u9875\u9762\u63D0\u53D6`, "neutral");
    await processPageQueue(pageFallback, false);
    updateMetrics();
  }
  async function processQueue(queue) {
    if (session.articleApiTabId && /^c_\d+$/.test(String(session.columnId || ""))) {
      return processArticleApiQueue(queue);
    }
    return processPageQueue(queue);
  }
  function extensionFrom(url, contentType) {
    const type = String(contentType || "").split(";")[0].toLowerCase();
    const byType = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/avif": "avif",
      "image/svg+xml": "svg"
    };
    if (byType[type]) return byType[type];
    try {
      const match = new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i);
      if (match && /^(jpe?g|png|gif|webp|avif|svg)$/i.test(match[1])) {
        return match[1].toLowerCase().replace("jpeg", "jpg");
      }
    } catch {
    }
    return "jpg";
  }
  async function fetchImage(image, articleNumber, imageNumber) {
    try {
      return await retryOperation(async () => {
        const response = await fetch(image.url, { credentials: "include" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        const extension = extensionFrom(image.url, response.headers.get("content-type"));
        const path = `assets/${padNumber(articleNumber)}/${padNumber(imageNumber, 2)}.${extension}`;
        return { ...image, ok: true, bytes, path };
      }, { attempts: 3, delays: [700, 1800] });
    } catch (error) {
      return { ...image, ok: false, path: image.url, reason: error.message || String(error) };
    }
  }
  async function localizeImages(article, articleNumber, files) {
    const images = article.images || [];
    const results = [];
    let cursor = 0;
    const workers = Array.from({ length: Math.min(4, images.length) }, async () => {
      while (cursor < images.length) {
        const current = cursor;
        cursor += 1;
        results[current] = await fetchImage(images[current], articleNumber, current + 1);
      }
    });
    await Promise.all(workers);
    let markdown = article.markdown;
    let html = article.html;
    for (const image of results) {
      const markdownPath = image.ok ? `../${image.path}` : image.path;
      const htmlPath = image.ok ? `../${image.path}` : image.path;
      markdown = markdown.replaceAll(image.placeholder, markdownPath);
      html = html.replaceAll(image.placeholder, escapeHtml(htmlPath));
      if (image.ok) files[image.path] = image.bytes;
      else {
        session.imageFailures.push({ sectionId: article.sectionId, title: article.title, url: image.url, reason: image.reason });
        addLog(`${article.title}\uFF1A\u56FE\u7247\u672A\u4E0B\u8F7D\uFF08${image.reason}\uFF09\uFF0C\u6B64\u56FE\u7247\u4ECD\u9700\u8054\u7F51\u67E5\u770B`, "error");
      }
    }
    return { markdown, html, downloaded: results.filter((item) => item.ok).length };
  }
  function keepRemoteImages(article) {
    let markdown = article.markdown;
    let html = article.html;
    for (const image of article.images || []) {
      markdown = markdown.replaceAll(image.placeholder, image.url);
      html = html.replaceAll(image.placeholder, escapeHtml(image.url));
    }
    return { markdown, html, downloaded: 0 };
  }
  var readerCss = `
:root { color-scheme: light; font-family: system-ui, "Microsoft YaHei", sans-serif; color: #202522; background: #f5f7f5; }
* { box-sizing: border-box; }
body { margin: 0; }
main { width: min(760px, calc(100% - 32px)); margin: 0 auto; padding: 44px 0 80px; }
header { margin-bottom: 34px; border-bottom: 1px solid #dfe4df; padding-bottom: 22px; }
h1 { margin: 0 0 12px; font-size: clamp(28px, 5vw, 42px); line-height: 1.2; letter-spacing: 0; }
h2, h3, h4 { margin: 1.8em 0 .7em; line-height: 1.35; letter-spacing: 0; }
p, li { font-size: 17px; line-height: 1.9; }
a { color: #17663f; text-underline-offset: 3px; }
.source { color: #657169; font-size: 14px; overflow-wrap: anywhere; }
img { display: block; max-width: 100%; height: auto; margin: 26px auto; }
blockquote { margin: 24px 0; padding: 2px 0 2px 18px; border-left: 3px solid #2f7d55; color: #4f5c54; }
pre { overflow: auto; padding: 16px; background: #e9eeea; border-radius: 6px; }
code { font-family: Consolas, monospace; }
table { width: 100%; border-collapse: collapse; overflow: auto; }
td, th { padding: 9px; border: 1px solid #ccd5ce; text-align: left; }
.index-list { list-style: none; padding: 0; margin: 28px 0; border-top: 1px solid #dfe4df; }
.index-list li { border-bottom: 1px solid #dfe4df; }
.index-list a { display: block; padding: 15px 2px; color: inherit; text-decoration: none; }
.index-list a:hover { color: #17663f; }
`;
  function articleHtml(article, body, index, total) {
    return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(article.title)}</title><link rel="stylesheet" href="../reader.css"></head>
<body><main><header><div class="source">${index} / ${total}</div><h1>${escapeHtml(article.title)}</h1>
<a class="source" href="${escapeHtml(article.url)}">\u67E5\u770B\u77E5\u4E4E\u539F\u6587</a></header><article>${body}</article></main></body></html>`;
  }
  function indexHtml(columnTitle, entries, exportedAt) {
    const items = entries.map((entry) => `<li><a href="html/${encodeURIComponent(entry.fileName)}.html">${escapeHtml(entry.title)}</a></li>`).join("\n");
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(columnTitle)}</title><link rel="stylesheet" href="reader.css"></head><body><main><header>
<div class="source">\u5BFC\u51FA\u4E8E ${escapeHtml(exportedAt)}</div><h1>${escapeHtml(columnTitle)}</h1>
<a class="source" href="${escapeHtml(session.sourceUrl)}">\u67E5\u770B\u77E5\u4E4E\u4E13\u680F</a></header><ol class="index-list">${items}</ol></main></body></html>`;
  }
  function zipAsync(files) {
    return new Promise((resolve, reject) => {
      zip(files, { level: 6 }, (error, data) => error ? reject(error) : resolve(data));
    });
  }
  async function buildArchive(partial = false) {
    if (!session.articles.length) throw new Error("\u6CA1\u6709\u53EF\u4FDD\u5B58\u7684\u6B63\u6587");
    setState("\u6B63\u5728\u6574\u7406\u6587\u4EF6", "\u6B63\u5728\u4E0B\u8F7D\u6B63\u6587\u56FE\u7247");
    const files = {};
    if (ui.html.checked) files["reader.css"] = strToU8(readerCss);
    const entries = [];
    const articleById = new Map(session.articles.map((article) => [article.sectionId, article]));
    const ordered = session.knownLinks.map((link) => articleById.get(link.sectionId)).filter(Boolean);
    let imageCount = 0;
    for (let index = 0; index < ordered.length; index += 1) {
      const article = ordered[index];
      const number = index + 1;
      setState("\u6B63\u5728\u6574\u7406\u6587\u4EF6", `${number} / ${ordered.length} \xB7 ${article.title}`);
      const localized = ui.images.checked ? await localizeImages(article, number, files) : keepRemoteImages(article);
      imageCount += localized.downloaded;
      const fileName = `${padNumber(number)}-${sanitizeFilename(article.title, `\u7AE0\u8282-${article.sectionId}`, 70)}`;
      entries.push({ ...article, fileName });
      if (ui.markdown.checked) {
        const markdown = `# ${article.title}

> \u539F\u6587\uFF1A${article.url}

${localized.markdown}
`;
        files[`articles/${fileName}.md`] = strToU8(markdown);
      }
      if (ui.html.checked) {
        files[`html/${fileName}.html`] = strToU8(articleHtml(article, localized.html, number, ordered.length));
      }
    }
    const exportedAt = new Intl.DateTimeFormat("zh-CN", { dateStyle: "long", timeStyle: "medium" }).format(/* @__PURE__ */ new Date());
    const successfulIds = new Set(entries.map((entry) => entry.sectionId));
    const expectedArticleCount = session.expectedArticleCount ?? session.knownLinks.length;
    const complete = !partial && session.failures.length === 0 && session.catalogComplete !== false && session.knownLinks.length > 0 && successfulIds.size === session.knownLinks.length && session.knownLinks.length === expectedArticleCount && session.imageFailures.length === 0;
    const readmeLines = [
      `# ${session.columnTitle}`,
      "",
      `- \u5BFC\u51FA\u65F6\u95F4\uFF1A${exportedAt}`,
      `- \u6587\u7AE0\u6765\u6E90\uFF1A${session.sourceUrl}`,
      `- \u6210\u529F\u7AE0\u8282\uFF1A${entries.length}`,
      `- \u53D1\u73B0\u7AE0\u8282\uFF1A${session.knownLinks.length}`,
      `- \u76EE\u5F55\u5E94\u6709\u7AE0\u8282\uFF1A${expectedArticleCount}`,
      `- \u672A\u5B8C\u6210\u7AE0\u8282\uFF1A${session.failures.length}`,
      `- \u5168\u91CF\u5B8C\u6210\uFF1A${complete ? "\u662F" : "\u5426"}`,
      `- \u672C\u5730\u56FE\u7247\uFF1A${imageCount}`,
      `- \u56FE\u7247\u4E0B\u8F7D\u5931\u8D25\uFF1A${session.imageFailures.length}`,
      "",
      "## \u76EE\u5F55",
      "",
      ...entries.map((entry, index) => {
        const target = ui.markdown.checked ? `articles/${encodeURIComponent(entry.fileName)}.md` : `html/${encodeURIComponent(entry.fileName)}.html`;
        return `${index + 1}. [${entry.title}](${target})`;
      })
    ];
    files["README.md"] = strToU8(readmeLines.join("\n"));
    if (ui.html.checked) files["index.html"] = strToU8(indexHtml(session.columnTitle, entries, exportedAt));
    const exportInfo = {
      title: session.columnTitle,
      source: session.sourceUrl,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      complete,
      partial: !complete,
      expectedArticleCount,
      discoveredArticleCount: session.knownLinks.length,
      catalogComplete: session.catalogComplete,
      articleCount: entries.length,
      failureCount: session.failures.length,
      imageFailureCount: session.imageFailures.length,
      imageCount,
      articles: entries.map(({ title, url, sectionId }) => ({ title, url, sectionId })),
      failures: session.failures,
      imageFailures: session.imageFailures
    };
    files["export-info.json"] = strToU8(JSON.stringify(exportInfo, null, 2));
    if (session.failures.length) {
      files["\u672A\u5BFC\u51FA\u7AE0\u8282.txt"] = strToU8(session.failures.map((item) => `${item.title}
${item.url}
\u539F\u56E0\uFF1A${item.reason}`).join("\n\n"));
    }
    if (session.imageFailures.length) {
      files["\u672A\u4E0B\u8F7D\u56FE\u7247.txt"] = strToU8([
        "\u4EE5\u4E0B\u56FE\u7247\u4E0B\u8F7D\u5931\u8D25\uFF0C\u6B63\u6587\u4E2D\u4FDD\u7559\u4E86\u539F\u59CB\u56FE\u7247\u5730\u5740\uFF0C\u9700\u8981\u8054\u7F51\u67E5\u770B\u3002\u53EF\u5728\u5BFC\u51FA\u9875\u70B9\u51FB\u201C\u91CD\u8BD5\u672A\u5B8C\u6210\u201D\u91CD\u65B0\u4E0B\u8F7D\u3002",
        ...session.imageFailures.map((item) => `${item.title}
${item.url}
\u539F\u56E0\uFF1A${item.reason}`)
      ].join("\n\n"));
    }
    setState("\u6B63\u5728\u751F\u6210\u538B\u7F29\u5305", `${Object.keys(files).length} \u4E2A\u6587\u4EF6`);
    const bytes = await zipAsync(files);
    lastArchive = {
      blob: new Blob([bytes], { type: "application/zip" }),
      fileName: `${sanitizeFilename(session.columnTitle, "\u77E5\u4E4E\u4ED8\u8D39\u4E13\u680F", 60)}-${complete ? "" : "\u90E8\u5206\u5BFC\u51FA-"}${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.zip`
    };
    return { articleCount: entries.length, imageCount, complete };
  }
  async function saveArchive() {
    if (!lastArchive) return;
    const objectUrl = URL.createObjectURL(lastArchive.blob);
    try {
      await chrome.downloads.download({ url: objectUrl, filename: lastArchive.fileName, saveAs: true });
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 6e4);
    }
  }
  async function finishExport(partial = false) {
    const summary = await buildArchive(partial);
    await saveArchive();
    const resultText = `${summary.articleCount} / ${session.expectedArticleCount ?? session.knownLinks.length} \u7BC7\u6587\u7AE0 \xB7 ${summary.imageCount} \u5F20\u672C\u5730\u56FE\u7247`;
    setState(summary.complete ? "\u5168\u90E8\u5BFC\u51FA\u5B8C\u6210" : "\u5DF2\u4FDD\u5B58\u90E8\u5206\u7ED3\u679C", resultText);
    addLog(summary.complete ? "\u5168\u91CF\u538B\u7F29\u5305\u5DF2\u751F\u6210" : `\u4ECD\u6709 ${session.failures.length} \u7BC7\u6587\u7AE0\u3001${session.imageFailures.length} \u5F20\u56FE\u7247\u672A\u5B8C\u6210`, summary.complete ? "success" : "error");
  }
  async function runExportAttempt() {
    let processingError = null;
    try {
      if (!session.knownLinks.length) await discoverCatalog();
      await processQueue(nextQueue());
    } catch (error) {
      processingError = error;
      setError(error.message || String(error));
    }
    session.failures = collectUnexportedArticles({
      links: session.knownLinks,
      articles: session.articles,
      failures: session.failures,
      reason: session.cancelled ? "\u7528\u6237\u505C\u6B62\u5BFC\u51FA\uFF0C\u5C1A\u672A\u5B8C\u6210" : processingError?.message || "\u672C\u6B21\u5BFC\u51FA\u672A\u5904\u7406\u5B8C\u6210"
    });
    try {
      if (!session.articles.length) throw new Error("\u6CA1\u6709\u6210\u529F\u5BFC\u51FA\u4EFB\u4F55\u7AE0\u8282");
      await finishExport(session.cancelled || Boolean(processingError));
    } catch (archiveError) {
      const message = archiveError.message || String(archiveError);
      setError(processingError ? `${processingError.message || processingError}\uFF1B\u7ED3\u679C\u4FDD\u5B58\u5931\u8D25\uFF1A${message}` : message);
      setState(session.cancelled ? "\u5DF2\u505C\u6B62" : "\u5BFC\u51FA\u672A\u5B8C\u6210", "");
    } finally {
      setRunning(false);
      updateMetrics();
      ui.saveAgain.hidden = !lastArchive;
      ui.retry.hidden = session.failures.length === 0 && session.imageFailures.length === 0;
    }
  }
  async function startExport() {
    if (session.running) return;
    if (!ui.markdown.checked && !ui.html.checked) {
      setError("\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u79CD\u6B63\u6587\u683C\u5F0F");
      return;
    }
    setError("");
    setRunning(true);
    session.cancelled = false;
    session.completedIds = new Set(session.articles.map((article) => article.sectionId));
    session.failures = [];
    session.imageFailures = [];
    ui.retry.hidden = true;
    ui.saveAgain.hidden = true;
    lastArchive = null;
    await runExportAttempt();
  }
  async function stopExport() {
    session.cancelled = true;
    setState("\u6B63\u5728\u505C\u6B62", "\u5DF2\u5B8C\u6210\u7684\u6587\u7AE0\u4F1A\u4FDD\u7559");
    await Promise.all([...activeTempTabIds].map((tabId) => closeTempTab(tabId)));
  }
  ui.start.addEventListener("click", startExport);
  ui.stop.addEventListener("click", stopExport);
  ui.retry.addEventListener("click", startExport);
  ui.saveAgain.addEventListener("click", () => {
    saveArchive().catch((error) => setError(`\u4FDD\u5B58\u5931\u8D25\uFF1A${error.message || error}`));
  });
  initialize();
})();
/*! Bundled license information:

lucide/dist/esm/createElement.js:
lucide/dist/esm/replaceElement.js:
lucide/dist/esm/defaultAttributes.js:
lucide/dist/esm/icons/book-down.js:
lucide/dist/esm/icons/circle-check.js:
lucide/dist/esm/icons/download.js:
lucide/dist/esm/icons/file-archive.js:
lucide/dist/esm/icons/loader-circle.js:
lucide/dist/esm/icons/rotate-ccw.js:
lucide/dist/esm/icons/square.js:
lucide/dist/esm/icons/triangle-alert.js:
lucide/dist/esm/lucide.js:
  (**
   * @license lucide v0.468.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/
