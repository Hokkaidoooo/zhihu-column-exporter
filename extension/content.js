(() => {
  // node_modules/turndown/lib/turndown.browser.es.js
  function extend(destination) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) destination[key] = source[key];
      }
    }
    return destination;
  }
  function repeat(character, count) {
    return Array(count + 1).join(character);
  }
  function trimLeadingNewlines(string) {
    return string.replace(/^\n*/, "");
  }
  function trimTrailingNewlines(string) {
    var indexEnd = string.length;
    while (indexEnd > 0 && string[indexEnd - 1] === "\n") indexEnd--;
    return string.substring(0, indexEnd);
  }
  function trimNewlines(string) {
    return trimTrailingNewlines(trimLeadingNewlines(string));
  }
  var blockElements = ["ADDRESS", "ARTICLE", "ASIDE", "AUDIO", "BLOCKQUOTE", "BODY", "CANVAS", "CENTER", "DD", "DIR", "DIV", "DL", "DT", "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "FRAMESET", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HGROUP", "HR", "HTML", "ISINDEX", "LI", "MAIN", "MENU", "NAV", "NOFRAMES", "NOSCRIPT", "OL", "OUTPUT", "P", "PRE", "SECTION", "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR", "UL"];
  function isBlock(node) {
    return is(node, blockElements);
  }
  var voidElements = ["AREA", "BASE", "BR", "COL", "COMMAND", "EMBED", "HR", "IMG", "INPUT", "KEYGEN", "LINK", "META", "PARAM", "SOURCE", "TRACK", "WBR"];
  function isVoid(node) {
    return is(node, voidElements);
  }
  function hasVoid(node) {
    return has(node, voidElements);
  }
  var meaningfulWhenBlankElements = ["A", "TABLE", "THEAD", "TBODY", "TFOOT", "TH", "TD", "IFRAME", "SCRIPT", "AUDIO", "VIDEO"];
  function isMeaningfulWhenBlank(node) {
    return is(node, meaningfulWhenBlankElements);
  }
  function hasMeaningfulWhenBlank(node) {
    return has(node, meaningfulWhenBlankElements);
  }
  function is(node, tagNames) {
    return tagNames.indexOf(node.nodeName) >= 0;
  }
  function has(node, tagNames) {
    return node.getElementsByTagName && tagNames.some(function(tagName) {
      return node.getElementsByTagName(tagName).length;
    });
  }
  var markdownEscapes = [[/\\/g, "\\\\"], [/\*/g, "\\*"], [/^-/g, "\\-"], [/^\+ /g, "\\+ "], [/^(=+)/g, "\\$1"], [/^(#{1,6}) /g, "\\$1 "], [/`/g, "\\`"], [/^~~~/g, "\\~~~"], [/\[/g, "\\["], [/\]/g, "\\]"], [/^>/g, "\\>"], [/_/g, "\\_"], [/^(\d+)\. /g, "$1\\. "]];
  function escapeMarkdown(string) {
    return markdownEscapes.reduce(function(accumulator, escape) {
      return accumulator.replace(escape[0], escape[1]);
    }, string);
  }
  var rules = {};
  rules.paragraph = {
    filter: "p",
    replacement: function(content) {
      return "\n\n" + content + "\n\n";
    }
  };
  rules.lineBreak = {
    filter: "br",
    replacement: function(content, node, options) {
      return options.br + "\n";
    }
  };
  rules.heading = {
    filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
    replacement: function(content, node, options) {
      var hLevel = Number(node.nodeName.charAt(1));
      if (options.headingStyle === "setext" && hLevel < 3) {
        var underline = repeat(hLevel === 1 ? "=" : "-", content.length);
        return "\n\n" + content + "\n" + underline + "\n\n";
      } else {
        return "\n\n" + repeat("#", hLevel) + " " + content + "\n\n";
      }
    }
  };
  rules.blockquote = {
    filter: "blockquote",
    replacement: function(content) {
      content = trimNewlines(content).replace(/^/gm, "> ");
      return "\n\n" + content + "\n\n";
    }
  };
  rules.list = {
    filter: ["ul", "ol"],
    replacement: function(content, node) {
      var parent = node.parentNode;
      if (parent.nodeName === "LI" && parent.lastElementChild === node) {
        return "\n" + content;
      } else {
        return "\n\n" + content + "\n\n";
      }
    }
  };
  rules.listItem = {
    filter: "li",
    replacement: function(content, node, options) {
      var prefix = options.bulletListMarker + "   ";
      var parent = node.parentNode;
      if (parent.nodeName === "OL") {
        var start = parent.getAttribute("start");
        var index = Array.prototype.indexOf.call(parent.children, node);
        prefix = (start ? Number(start) + index : index + 1) + ".  ";
      }
      var isParagraph = /\n$/.test(content);
      content = trimNewlines(content) + (isParagraph ? "\n" : "");
      content = content.replace(/\n/gm, "\n" + " ".repeat(prefix.length));
      return prefix + content + (node.nextSibling ? "\n" : "");
    }
  };
  rules.indentedCodeBlock = {
    filter: function(node, options) {
      return options.codeBlockStyle === "indented" && node.nodeName === "PRE" && node.firstChild && node.firstChild.nodeName === "CODE";
    },
    replacement: function(content, node, options) {
      return "\n\n    " + node.firstChild.textContent.replace(/\n/g, "\n    ") + "\n\n";
    }
  };
  rules.fencedCodeBlock = {
    filter: function(node, options) {
      return options.codeBlockStyle === "fenced" && node.nodeName === "PRE" && node.firstChild && node.firstChild.nodeName === "CODE";
    },
    replacement: function(content, node, options) {
      var className = node.firstChild.getAttribute("class") || "";
      var language = (className.match(/language-(\S+)/) || [null, ""])[1];
      var code = node.firstChild.textContent;
      var fenceChar = options.fence.charAt(0);
      var fenceSize = 3;
      var fenceInCodeRegex = new RegExp("^" + fenceChar + "{3,}", "gm");
      var match;
      while (match = fenceInCodeRegex.exec(code)) {
        if (match[0].length >= fenceSize) {
          fenceSize = match[0].length + 1;
        }
      }
      var fence = repeat(fenceChar, fenceSize);
      return "\n\n" + fence + language + "\n" + code.replace(/\n$/, "") + "\n" + fence + "\n\n";
    }
  };
  rules.horizontalRule = {
    filter: "hr",
    replacement: function(content, node, options) {
      return "\n\n" + options.hr + "\n\n";
    }
  };
  rules.inlineLink = {
    filter: function(node, options) {
      return options.linkStyle === "inlined" && node.nodeName === "A" && node.getAttribute("href");
    },
    replacement: function(content, node) {
      var href = escapeLinkDestination(node.getAttribute("href"));
      var title = escapeLinkTitle(cleanAttribute(node.getAttribute("title")));
      var titlePart = title ? ' "' + title + '"' : "";
      return "[" + content + "](" + href + titlePart + ")";
    }
  };
  rules.referenceLink = {
    filter: function(node, options) {
      return options.linkStyle === "referenced" && node.nodeName === "A" && node.getAttribute("href");
    },
    replacement: function(content, node, options) {
      var href = escapeLinkDestination(node.getAttribute("href"));
      var title = cleanAttribute(node.getAttribute("title"));
      if (title) title = ' "' + escapeLinkTitle(title) + '"';
      var replacement;
      var reference;
      switch (options.linkReferenceStyle) {
        case "collapsed":
          replacement = "[" + content + "][]";
          reference = "[" + content + "]: " + href + title;
          break;
        case "shortcut":
          replacement = "[" + content + "]";
          reference = "[" + content + "]: " + href + title;
          break;
        default:
          var id = this.references.length + 1;
          replacement = "[" + content + "][" + id + "]";
          reference = "[" + id + "]: " + href + title;
      }
      this.references.push(reference);
      return replacement;
    },
    references: [],
    append: function(options) {
      var references = "";
      if (this.references.length) {
        references = "\n\n" + this.references.join("\n") + "\n\n";
        this.references = [];
      }
      return references;
    }
  };
  rules.emphasis = {
    filter: ["em", "i"],
    replacement: function(content, node, options) {
      if (!content.trim()) return "";
      return options.emDelimiter + content + options.emDelimiter;
    }
  };
  rules.strong = {
    filter: ["strong", "b"],
    replacement: function(content, node, options) {
      if (!content.trim()) return "";
      return options.strongDelimiter + content + options.strongDelimiter;
    }
  };
  rules.code = {
    filter: function(node) {
      var hasSiblings = node.previousSibling || node.nextSibling;
      var isCodeBlock = node.parentNode.nodeName === "PRE" && !hasSiblings;
      return node.nodeName === "CODE" && !isCodeBlock;
    },
    replacement: function(content) {
      if (!content) return "";
      content = content.replace(/\r?\n|\r/g, " ");
      var extraSpace = /^`|^ .*?[^ ].* $|`$/.test(content) ? " " : "";
      var delimiter = "`";
      var matches = content.match(/`+/gm) || [];
      while (matches.indexOf(delimiter) !== -1) delimiter = delimiter + "`";
      return delimiter + extraSpace + content + extraSpace + delimiter;
    }
  };
  rules.image = {
    filter: "img",
    replacement: function(content, node) {
      var alt = escapeMarkdown(cleanAttribute(node.getAttribute("alt")));
      var src = escapeLinkDestination(node.getAttribute("src") || "");
      var title = cleanAttribute(node.getAttribute("title"));
      var titlePart = title ? ' "' + escapeLinkTitle(title) + '"' : "";
      return src ? "![" + alt + "](" + src + titlePart + ")" : "";
    }
  };
  function cleanAttribute(attribute) {
    return attribute ? attribute.replace(/(\n+\s*)+/g, "\n") : "";
  }
  function escapeLinkDestination(destination) {
    var escaped = destination.replace(/([<>()])/g, "\\$1");
    return escaped.indexOf(" ") >= 0 ? "<" + escaped + ">" : escaped;
  }
  function escapeLinkTitle(title) {
    return title.replace(/"/g, '\\"');
  }
  function Rules(options) {
    this.options = options;
    this._keep = [];
    this._remove = [];
    this.blankRule = {
      replacement: options.blankReplacement
    };
    this.keepReplacement = options.keepReplacement;
    this.defaultRule = {
      replacement: options.defaultReplacement
    };
    this.array = [];
    for (var key in options.rules) this.array.push(options.rules[key]);
  }
  Rules.prototype = {
    add: function(key, rule) {
      this.array.unshift(rule);
    },
    keep: function(filter) {
      this._keep.unshift({
        filter,
        replacement: this.keepReplacement
      });
    },
    remove: function(filter) {
      this._remove.unshift({
        filter,
        replacement: function() {
          return "";
        }
      });
    },
    forNode: function(node) {
      if (node.isBlank) return this.blankRule;
      var rule;
      if (rule = findRule(this.array, node, this.options)) return rule;
      if (rule = findRule(this._keep, node, this.options)) return rule;
      if (rule = findRule(this._remove, node, this.options)) return rule;
      return this.defaultRule;
    },
    forEach: function(fn) {
      for (var i = 0; i < this.array.length; i++) fn(this.array[i], i);
    }
  };
  function findRule(rules3, node, options) {
    for (var i = 0; i < rules3.length; i++) {
      var rule = rules3[i];
      if (filterValue(rule, node, options)) return rule;
    }
    return void 0;
  }
  function filterValue(rule, node, options) {
    var filter = rule.filter;
    if (typeof filter === "string") {
      if (filter === node.nodeName.toLowerCase()) return true;
    } else if (Array.isArray(filter)) {
      if (filter.indexOf(node.nodeName.toLowerCase()) > -1) return true;
    } else if (typeof filter === "function") {
      if (filter.call(rule, node, options)) return true;
    } else {
      throw new TypeError("`filter` needs to be a string, array, or function");
    }
  }
  function collapseWhitespace(options) {
    var element = options.element;
    var isBlock2 = options.isBlock;
    var isVoid2 = options.isVoid;
    var isPre = options.isPre || function(node2) {
      return node2.nodeName === "PRE";
    };
    if (!element.firstChild || isPre(element)) return;
    var prevText = null;
    var keepLeadingWs = false;
    var prev = null;
    var node = next(prev, element, isPre);
    while (node !== element) {
      if (node.nodeType === 3 || node.nodeType === 4) {
        var text = node.data.replace(/[ \r\n\t]+/g, " ");
        if ((!prevText || / $/.test(prevText.data)) && !keepLeadingWs && text[0] === " ") {
          text = text.substr(1);
        }
        if (!text) {
          node = remove(node);
          continue;
        }
        node.data = text;
        prevText = node;
      } else if (node.nodeType === 1) {
        if (isBlock2(node) || node.nodeName === "BR") {
          if (prevText) {
            prevText.data = prevText.data.replace(/ $/, "");
          }
          prevText = null;
          keepLeadingWs = false;
        } else if (isVoid2(node) || isPre(node)) {
          prevText = null;
          keepLeadingWs = true;
        } else if (prevText) {
          keepLeadingWs = false;
        }
      } else {
        node = remove(node);
        continue;
      }
      var nextNode = next(prev, node, isPre);
      prev = node;
      node = nextNode;
    }
    if (prevText) {
      prevText.data = prevText.data.replace(/ $/, "");
      if (!prevText.data) {
        remove(prevText);
      }
    }
  }
  function remove(node) {
    var next2 = node.nextSibling || node.parentNode;
    node.parentNode.removeChild(node);
    return next2;
  }
  function next(prev, current, isPre) {
    if (prev && prev.parentNode === current || isPre(current)) {
      return current.nextSibling || current.parentNode;
    }
    return current.firstChild || current.nextSibling || current.parentNode;
  }
  var root = typeof window !== "undefined" ? window : {};
  function canParseHTMLNatively() {
    var Parser = root.DOMParser;
    var canParse = false;
    try {
      if (new Parser().parseFromString("", "text/html")) {
        canParse = true;
      }
    } catch (e) {
    }
    return canParse;
  }
  function createHTMLParser() {
    var Parser = function() {
    };
    {
      if (shouldUseActiveX()) {
        Parser.prototype.parseFromString = function(string) {
          var doc = new window.ActiveXObject("htmlfile");
          doc.designMode = "on";
          doc.open();
          doc.write(string);
          doc.close();
          return doc;
        };
      } else {
        Parser.prototype.parseFromString = function(string) {
          var doc = document.implementation.createHTMLDocument("");
          doc.open();
          doc.write(string);
          doc.close();
          return doc;
        };
      }
    }
    return Parser;
  }
  function shouldUseActiveX() {
    var useActiveX = false;
    try {
      document.implementation.createHTMLDocument("").open();
    } catch (e) {
      if (root.ActiveXObject) useActiveX = true;
    }
    return useActiveX;
  }
  var HTMLParser = canParseHTMLNatively() ? root.DOMParser : createHTMLParser();
  function RootNode(input, options) {
    var root2;
    if (typeof input === "string") {
      var doc = htmlParser().parseFromString(
        // DOM parsers arrange elements in the <head> and <body>.
        // Wrapping in a custom element ensures elements are reliably arranged in
        // a single element.
        '<x-turndown id="turndown-root">' + input + "</x-turndown>",
        "text/html"
      );
      root2 = doc.getElementById("turndown-root");
    } else {
      root2 = input.cloneNode(true);
    }
    collapseWhitespace({
      element: root2,
      isBlock,
      isVoid,
      isPre: options.preformattedCode ? isPreOrCode : null
    });
    return root2;
  }
  var _htmlParser;
  function htmlParser() {
    _htmlParser = _htmlParser || new HTMLParser();
    return _htmlParser;
  }
  function isPreOrCode(node) {
    return node.nodeName === "PRE" || node.nodeName === "CODE";
  }
  function Node(node, options) {
    node.isBlock = isBlock(node);
    node.isCode = node.nodeName === "CODE" || node.parentNode.isCode;
    node.isBlank = isBlank(node);
    node.flankingWhitespace = flankingWhitespace(node, options);
    return node;
  }
  function isBlank(node) {
    return !isVoid(node) && !isMeaningfulWhenBlank(node) && /^\s*$/i.test(node.textContent) && !hasVoid(node) && !hasMeaningfulWhenBlank(node);
  }
  function flankingWhitespace(node, options) {
    if (node.isBlock || options.preformattedCode && node.isCode) {
      return {
        leading: "",
        trailing: ""
      };
    }
    var edges = edgeWhitespace(node.textContent);
    if (edges.leadingAscii && isFlankedByWhitespace("left", node, options)) {
      edges.leading = edges.leadingNonAscii;
    }
    if (edges.trailingAscii && isFlankedByWhitespace("right", node, options)) {
      edges.trailing = edges.trailingNonAscii;
    }
    return {
      leading: edges.leading,
      trailing: edges.trailing
    };
  }
  function edgeWhitespace(string) {
    var m = string.match(/^(([ \t\r\n]*)(\s*))(?:(?=\S)[\s\S]*\S)?((\s*?)([ \t\r\n]*))$/);
    return {
      leading: m[1],
      // whole string for whitespace-only strings
      leadingAscii: m[2],
      leadingNonAscii: m[3],
      trailing: m[4],
      // empty for whitespace-only strings
      trailingNonAscii: m[5],
      trailingAscii: m[6]
    };
  }
  function isFlankedByWhitespace(side, node, options) {
    var sibling;
    var regExp;
    var isFlanked;
    if (side === "left") {
      sibling = node.previousSibling;
      regExp = / $/;
    } else {
      sibling = node.nextSibling;
      regExp = /^ /;
    }
    if (sibling) {
      if (sibling.nodeType === 3) {
        isFlanked = regExp.test(sibling.nodeValue);
      } else if (options.preformattedCode && sibling.nodeName === "CODE") {
        isFlanked = false;
      } else if (sibling.nodeType === 1 && !isBlock(sibling)) {
        isFlanked = regExp.test(sibling.textContent);
      }
    }
    return isFlanked;
  }
  var reduce = Array.prototype.reduce;
  function TurndownService(options) {
    if (!(this instanceof TurndownService)) return new TurndownService(options);
    var defaults = {
      rules,
      headingStyle: "setext",
      hr: "* * *",
      bulletListMarker: "*",
      codeBlockStyle: "indented",
      fence: "```",
      emDelimiter: "_",
      strongDelimiter: "**",
      linkStyle: "inlined",
      linkReferenceStyle: "full",
      br: "  ",
      preformattedCode: false,
      blankReplacement: function(content, node) {
        return node.isBlock ? "\n\n" : "";
      },
      keepReplacement: function(content, node) {
        return node.isBlock ? "\n\n" + node.outerHTML + "\n\n" : node.outerHTML;
      },
      defaultReplacement: function(content, node) {
        return node.isBlock ? "\n\n" + content + "\n\n" : content;
      }
    };
    this.options = extend({}, defaults, options);
    this.rules = new Rules(this.options);
  }
  TurndownService.prototype = {
    /**
     * The entry point for converting a string or DOM node to Markdown
     * @public
     * @param {String|HTMLElement} input The string or DOM node to convert
     * @returns A Markdown representation of the input
     * @type String
     */
    turndown: function(input) {
      if (!canConvert(input)) {
        throw new TypeError(input + " is not a string, or an element/document/fragment node.");
      }
      if (input === "") return "";
      var output = process.call(this, new RootNode(input, this.options));
      return postProcess.call(this, output);
    },
    /**
     * Add one or more plugins
     * @public
     * @param {Function|Array} plugin The plugin or array of plugins to add
     * @returns The Turndown instance for chaining
     * @type Object
     */
    use: function(plugin) {
      if (Array.isArray(plugin)) {
        for (var i = 0; i < plugin.length; i++) this.use(plugin[i]);
      } else if (typeof plugin === "function") {
        plugin(this);
      } else {
        throw new TypeError("plugin must be a Function or an Array of Functions");
      }
      return this;
    },
    /**
     * Adds a rule
     * @public
     * @param {String} key The unique key of the rule
     * @param {Object} rule The rule
     * @returns The Turndown instance for chaining
     * @type Object
     */
    addRule: function(key, rule) {
      this.rules.add(key, rule);
      return this;
    },
    /**
     * Keep a node (as HTML) that matches the filter
     * @public
     * @param {String|Array|Function} filter The unique key of the rule
     * @returns The Turndown instance for chaining
     * @type Object
     */
    keep: function(filter) {
      this.rules.keep(filter);
      return this;
    },
    /**
     * Remove a node that matches the filter
     * @public
     * @param {String|Array|Function} filter The unique key of the rule
     * @returns The Turndown instance for chaining
     * @type Object
     */
    remove: function(filter) {
      this.rules.remove(filter);
      return this;
    },
    /**
     * Escapes Markdown syntax
     * @public
     * @param {String} string The string to escape
     * @returns A string with Markdown syntax escaped
     * @type String
     */
    escape: function(string) {
      return escapeMarkdown(string);
    }
  };
  function process(parentNode) {
    var self = this;
    return reduce.call(parentNode.childNodes, function(output, node) {
      node = new Node(node, self.options);
      var replacement = "";
      if (node.nodeType === 3) {
        replacement = node.isCode ? node.nodeValue : self.escape(node.nodeValue);
      } else if (node.nodeType === 1) {
        replacement = replacementForNode.call(self, node);
      }
      return join(output, replacement);
    }, "");
  }
  function postProcess(output) {
    var self = this;
    this.rules.forEach(function(rule) {
      if (typeof rule.append === "function") {
        output = join(output, rule.append(self.options));
      }
    });
    return output.replace(/^[\t\r\n]+/, "").replace(/[\t\r\n\s]+$/, "");
  }
  function replacementForNode(node) {
    var rule = this.rules.forNode(node);
    var content = process.call(this, node);
    var whitespace = node.flankingWhitespace;
    if (whitespace.leading || whitespace.trailing) content = content.trim();
    return whitespace.leading + rule.replacement(content, node, this.options) + whitespace.trailing;
  }
  function join(output, replacement) {
    var s1 = trimTrailingNewlines(output);
    var s2 = trimLeadingNewlines(replacement);
    var nls = Math.max(output.length - s1.length, replacement.length - s2.length);
    var separator = "\n\n".substring(0, nls);
    return s1 + separator + s2;
  }
  function canConvert(input) {
    return input != null && (typeof input === "string" || input.nodeType && (input.nodeType === 1 || input.nodeType === 9 || input.nodeType === 11));
  }

  // node_modules/turndown-plugin-gfm/lib/turndown-plugin-gfm.es.js
  var highlightRegExp = /highlight-(?:text|source)-([a-z0-9]+)/;
  function highlightedCodeBlock(turndownService) {
    turndownService.addRule("highlightedCodeBlock", {
      filter: function(node) {
        var firstChild = node.firstChild;
        return node.nodeName === "DIV" && highlightRegExp.test(node.className) && firstChild && firstChild.nodeName === "PRE";
      },
      replacement: function(content, node, options) {
        var className = node.className || "";
        var language = (className.match(highlightRegExp) || [null, ""])[1];
        return "\n\n" + options.fence + language + "\n" + node.firstChild.textContent + "\n" + options.fence + "\n\n";
      }
    });
  }
  function strikethrough(turndownService) {
    turndownService.addRule("strikethrough", {
      filter: ["del", "s", "strike"],
      replacement: function(content) {
        return "~" + content + "~";
      }
    });
  }
  var indexOf = Array.prototype.indexOf;
  var every = Array.prototype.every;
  var rules2 = {};
  rules2.tableCell = {
    filter: ["th", "td"],
    replacement: function(content, node) {
      return cell(content, node);
    }
  };
  rules2.tableRow = {
    filter: "tr",
    replacement: function(content, node) {
      var borderCells = "";
      var alignMap = { left: ":--", right: "--:", center: ":-:" };
      if (isHeadingRow(node)) {
        for (var i = 0; i < node.childNodes.length; i++) {
          var border = "---";
          var align = (node.childNodes[i].getAttribute("align") || "").toLowerCase();
          if (align) border = alignMap[align] || border;
          borderCells += cell(border, node.childNodes[i]);
        }
      }
      return "\n" + content + (borderCells ? "\n" + borderCells : "");
    }
  };
  rules2.table = {
    // Only convert tables with a heading row.
    // Tables with no heading row are kept using `keep` (see below).
    filter: function(node) {
      return node.nodeName === "TABLE" && isHeadingRow(node.rows[0]);
    },
    replacement: function(content) {
      content = content.replace("\n\n", "\n");
      return "\n\n" + content + "\n\n";
    }
  };
  rules2.tableSection = {
    filter: ["thead", "tbody", "tfoot"],
    replacement: function(content) {
      return content;
    }
  };
  function isHeadingRow(tr) {
    var parentNode = tr.parentNode;
    return parentNode.nodeName === "THEAD" || parentNode.firstChild === tr && (parentNode.nodeName === "TABLE" || isFirstTbody(parentNode)) && every.call(tr.childNodes, function(n) {
      return n.nodeName === "TH";
    });
  }
  function isFirstTbody(element) {
    var previousSibling = element.previousSibling;
    return element.nodeName === "TBODY" && (!previousSibling || previousSibling.nodeName === "THEAD" && /^\s*$/i.test(previousSibling.textContent));
  }
  function cell(content, node) {
    var index = indexOf.call(node.parentNode.childNodes, node);
    var prefix = " ";
    if (index === 0) prefix = "| ";
    return prefix + content + " |";
  }
  function tables(turndownService) {
    turndownService.keep(function(node) {
      return node.nodeName === "TABLE" && !isHeadingRow(node.rows[0]);
    });
    for (var key in rules2) turndownService.addRule(key, rules2[key]);
  }
  function taskListItems(turndownService) {
    turndownService.addRule("taskListItems", {
      filter: function(node) {
        return node.type === "checkbox" && node.parentNode.nodeName === "LI";
      },
      replacement: function(content, node) {
        return (node.checked ? "[x]" : "[ ]") + " ";
      }
    });
  }
  function gfm(turndownService) {
    turndownService.use([
      highlightedCodeBlock,
      strikethrough,
      tables,
      taskListItems
    ]);
  }

  // src/shared.js
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
  function canonicalSectionUrl(columnId, sectionId) {
    if (!/^(?:c_)?\d+$/.test(String(columnId)) || !/^\d+$/.test(String(sectionId))) {
      throw new TypeError("\u4E13\u680F ID \u548C\u7AE0\u8282 ID \u5FC5\u987B\u662F\u6570\u5B57");
    }
    if (String(columnId).startsWith("c_")) return `https://zhuanlan.zhihu.com/p/${sectionId}`;
    return `https://www.zhihu.com/market/paid_column/${columnId}/section/${sectionId}`;
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

  // src/article-api.js
  function sourceFromArticleItem(item) {
    return item?.target || item?.article || item;
  }
  function sectionIdFromArticleItem(item) {
    const source = sourceFromArticleItem(item);
    const candidateUrls = [source?.url, item?.url, source?.canonical_url, item?.canonical_url];
    for (const candidate of candidateUrls) {
      const parsed = parsePaidColumnUrl(candidate);
      if (parsed?.sectionId) return parsed.sectionId;
    }
    const candidateIds = [source?.id, item?.id];
    for (const candidate of candidateIds) {
      if (typeof candidate === "string" && /^\d+$/.test(candidate)) return candidate;
      if (Number.isSafeInteger(candidate) && candidate >= 0) return String(candidate);
    }
    return null;
  }
  function normalizeColumnArticleItem(item, columnId) {
    const source = sourceFromArticleItem(item);
    const sectionId = sectionIdFromArticleItem(item);
    if (!sectionId) return { ok: false, reason: "\u76EE\u5F55\u6587\u7AE0\u7F3A\u5C11\u7CBE\u786E ID" };
    const regularContent = typeof source?.content === "string" ? source.content.trim() : "";
    if (!regularContent) return { ok: false, sectionId, reason: "\u76EE\u5F55\u63A5\u53E3\u6CA1\u6709\u8FD4\u56DE\u6807\u51C6\u6B63\u6587" };
    const title = String(source?.title ?? item?.title ?? `\u6587\u7AE0 ${sectionId}`).replace(/\s+/g, " ").trim();
    return {
      ok: true,
      columnId,
      sectionId,
      title: title || `\u6587\u7AE0 ${sectionId}`,
      url: canonicalSectionUrl(columnId, sectionId),
      content: regularContent,
      requiresAccessValidation: source?.content_need_truncated === true
    };
  }

  // src/article-detail-api.js
  var API_ORIGINS = /* @__PURE__ */ new Set(["https://www.zhihu.com", "https://zhuanlan.zhihu.com"]);
  var ACCESS_LOCK_PATTERN = /(订阅后.{0,8}(阅读|解锁)|购买后.{0,8}阅读|立即订阅|登录后.{0,8}(查看|阅读)|试看已结束)/;
  function normalizedOrigin(value) {
    const origin = String(value || "").replace(/\/+$/, "");
    if (!API_ORIGINS.has(origin)) throw new TypeError("\u6587\u7AE0\u63A5\u53E3\u57DF\u540D\u4E0D\u53D7\u4FE1\u4EFB");
    return origin;
  }
  function articleDetailApiUrl(sectionId, apiOrigin) {
    if (!/^\d+$/.test(String(sectionId || ""))) throw new TypeError("\u6587\u7AE0 ID \u5FC5\u987B\u662F\u7CBE\u786E\u6570\u5B57\u5B57\u7B26\u4E32");
    const origin = normalizedOrigin(apiOrigin);
    const path = origin === "https://zhuanlan.zhihu.com" ? `/api/articles/${sectionId}` : `/api/v4/articles/${sectionId}`;
    if (origin === "https://zhuanlan.zhihu.com") return `${origin}${path}`;
    const params = new URLSearchParams({ include: "title,content,excerpt,content_need_truncated,url" });
    return `${origin}${path}?${params}`;
  }
  function normalizeArticleDetailPayload(payload, columnId, requestedSectionId) {
    const sectionId = String(requestedSectionId || "");
    if (!/^\d+$/.test(sectionId)) return { ok: false, reason: "\u8BF7\u6C42\u7684\u6587\u7AE0 ID \u65E0\u6548" };
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { ok: false, sectionId, reason: "\u6587\u7AE0\u63A5\u53E3\u8FD4\u56DE\u4E86\u65E0\u6548\u6570\u636E" };
    }
    if (payload.error) {
      return { ok: false, sectionId, reason: payload.error.message || "\u6587\u7AE0\u63A5\u53E3\u62D2\u7EDD\u8BBF\u95EE" };
    }
    const responseSectionId = sectionIdFromArticleItem(payload);
    if (responseSectionId && responseSectionId !== sectionId) {
      return { ok: false, sectionId, reason: `\u6587\u7AE0\u63A5\u53E3\u8EAB\u4EFD\u4E0D\u5339\u914D\uFF1A\u5B9E\u9645\u8FD4\u56DE ${responseSectionId}` };
    }
    const source = sourceFromArticleItem(payload);
    const content = typeof source?.content === "string" ? source.content : "";
    if (content.length < 8e3 && ACCESS_LOCK_PATTERN.test(content)) {
      return { ok: false, sectionId, accessDenied: true, reason: "\u6587\u7AE0\u63A5\u53E3\u53EA\u8FD4\u56DE\u4E86\u6743\u9650\u5360\u4F4D\u5185\u5BB9" };
    }
    if (source?.content_need_truncated === true) {
      return {
        ok: false,
        sectionId,
        truncated: true,
        reason: "\u6587\u7AE0\u63A5\u53E3\u6807\u8BB0\u6B63\u6587\u5DF2\u88AB\u77E5\u4E4E\u622A\u65AD\uFF0C\u53EA\u8FD4\u56DE\u8BD5\u770B\u7247\u6BB5"
      };
    }
    const safeItem = {
      url: canonicalSectionUrl(columnId, sectionId),
      title: source?.title,
      content,
      content_need_truncated: false
    };
    return normalizeColumnArticleItem(safeItem, columnId);
  }
  async function fetchArticleDetail({
    sectionId,
    columnId,
    apiOrigin,
    credentials = "include",
    request = fetch
  }) {
    let response;
    try {
      response = await request(articleDetailApiUrl(sectionId, apiOrigin), {
        credentials,
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
    } catch (error) {
      return { ok: false, sectionId, retryable: true, reason: error?.message || String(error) };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        sectionId,
        accessDenied: true,
        status: response.status,
        reason: `\u6587\u7AE0\u63A5\u53E3\u8FD4\u56DE HTTP ${response.status}`
      };
    }
    if (response.status === 429 || response.status >= 500) {
      return {
        ok: false,
        sectionId,
        retryable: true,
        status: response.status,
        reason: `\u6587\u7AE0\u63A5\u53E3\u8FD4\u56DE HTTP ${response.status}`
      };
    }
    if (!response.ok) {
      return { ok: false, sectionId, status: response.status, reason: `\u6587\u7AE0\u63A5\u53E3\u8FD4\u56DE HTTP ${response.status}` };
    }
    const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
    if (!contentType.includes("application/json")) {
      return { ok: false, sectionId, reason: "\u6587\u7AE0\u63A5\u53E3\u6CA1\u6709\u8FD4\u56DE JSON" };
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      return { ok: false, sectionId, reason: "\u6587\u7AE0\u63A5\u53E3 JSON \u65E0\u6CD5\u89E3\u6790" };
    }
    return normalizeArticleDetailPayload(payload, columnId, sectionId);
  }

  // src/article-readiness.js
  var NOT_READY = "";
  function articleFingerprint(result) {
    if (!result?.ok) return NOT_READY;
    return JSON.stringify([
      result.sectionId || "",
      result.title || "",
      result.markdown || "",
      result.html || "",
      (result.images || []).map(({ url }) => url)
    ]);
  }
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
  async function waitForArticleExtraction({
    extract,
    wait,
    probe = null,
    attempts = 30,
    intervalMs = 150,
    stableSamples = 3,
    minimumStableMs = 300,
    emptyLimit = Infinity
  }) {
    if (typeof extract !== "function") throw new TypeError("\u6B63\u6587\u63D0\u53D6\u5668\u5FC5\u987B\u662F\u51FD\u6570");
    if (probe !== null && typeof probe !== "function") throw new TypeError("\u6B63\u6587\u63A2\u9488\u5FC5\u987B\u662F\u51FD\u6570");
    let result = null;
    const sample = probe ? () => String(probe()?.fingerprint ?? NOT_READY) : () => {
      result = extract();
      return articleFingerprint(result);
    };
    const settle = await settleFingerprint({
      sample,
      wait,
      attempts,
      intervalMs,
      stableSamples,
      minimumStableMs,
      emptyLimit
    });
    if (probe) result = extract();
    if (settle.settled) return result;
    return result?.ok ? { ok: false, reason: "\u6B63\u6587\u5185\u5BB9\u5728\u7B49\u5F85\u671F\u95F4\u4ECD\u5728\u53D8\u5316\uFF0C\u8BF7\u91CD\u8BD5" } : result;
  }

  // src/content-core.js
  var TITLE_SELECTORS = [
    "h1",
    '[class*="BookInfo-title"]',
    '[class*="Column-title"]',
    '[class*="PaidColumn"] [class*="title"]',
    "main h2"
  ];
  var CONTENT_SELECTORS = [
    ".RichText",
    '[class~="RichText"]',
    '[class*="RichText"]',
    "article",
    '[class*="SectionContent"]',
    '[class*="section-content"]',
    '[class*="Content-content"]',
    "main"
  ];
  var REMOVE_SELECTORS = [
    "script",
    "style",
    "noscript",
    "template",
    "button",
    "input",
    "textarea",
    "select",
    "iframe",
    "nav",
    "aside",
    "footer",
    '[role="navigation"]',
    '[class*="Comments-container"]',
    '[class*="Recommendations"]',
    '[class*="Reward"]',
    '[class*="ShareMenu"]',
    '[class*="Modal"]'
  ];
  var ACCESS_LOCK_PATTERN2 = /(订阅后.{0,8}(阅读|解锁)|购买后.{0,8}阅读|立即订阅|登录后.{0,8}(查看|阅读)|试看已结束)/;
  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }
  function usefulTitle(value) {
    const title = cleanText(value).replace(/\s*[-–|]\s*知乎\s*$/, "").replace(/^知乎\s*[-–|]\s*/, "");
    if (!title || title === "\u77E5\u4E4E" || title.length > 180) return "";
    return title;
  }
  function detectPageTitle(document2, fallback = "\u77E5\u4E4E\u4ED8\u8D39\u4E13\u680F") {
    for (const selector of TITLE_SELECTORS) {
      for (const element of document2.querySelectorAll(selector)) {
        const title = usefulTitle(element.textContent);
        if (title) return title;
      }
    }
    return usefulTitle(document2.title) || fallback;
  }
  function inferPaidColumnInfo(document2, pageUrl) {
    const direct = parsePaidColumnUrl(pageUrl);
    if (direct?.columnId) return direct;
    const candidateUrls = [];
    document2.querySelectorAll('link[rel="canonical"][href],meta[property="og:url"][content],a[href]').forEach((element) => {
      const value = element.getAttribute("href") || element.getAttribute("content");
      if (!value) return;
      try {
        candidateUrls.push(new URL(value, pageUrl).href);
      } catch {
      }
    });
    for (const candidate of candidateUrls) {
      const parsed = parsePaidColumnUrl(candidate);
      if (!parsed) continue;
      if (direct?.sectionId && parsed.columnId) {
        return { columnId: parsed.columnId, sectionId: direct.sectionId, kind: "section" };
      }
      if (parsed.columnId) return parsed;
    }
    const markup = document2.documentElement?.innerHTML?.replaceAll("\\/", "/") || "";
    const urlMatch = markup.match(/(?:https?:\/\/www\.zhihu\.com)?\/(?:xen\/market\/(?:remix\/)?|market\/)paid_column\/(\d+)(?:\/section\/(\d+))?/);
    if (urlMatch) {
      return {
        columnId: urlMatch[1],
        sectionId: urlMatch[2] || null,
        kind: urlMatch[2] ? "section" : "catalog"
      };
    }
    const columnMatch = markup.match(/["'](?:columnId|column_id|paidColumnId|paid_column_id)["']\s*:\s*["']?((?:c_)?\d+)/i);
    const sectionMatch = markup.match(/["'](?:sectionId|section_id)["']\s*:\s*["']?(\d+)/i);
    if (!columnMatch) return direct;
    const columnId = direct?.sectionId && !String(columnMatch[1]).startsWith("c_") ? `c_${columnMatch[1]}` : columnMatch[1];
    return {
      columnId,
      sectionId: direct?.sectionId || sectionMatch?.[1] || null,
      kind: direct?.sectionId || sectionMatch ? "section" : "catalog"
    };
  }
  function titleNear(element, sectionId) {
    const ownTitle = cleanText(element.getAttribute?.("title"));
    if (ownTitle) return ownTitle;
    const heading = element.querySelector?.("h2,h3,h4,[class*='title'],[class*='Title']");
    const headingText = cleanText(heading?.textContent);
    if (headingText) return headingText;
    const text = cleanText(element.textContent);
    if (text && text.length <= 180) return text;
    return `\u7AE0\u8282 ${sectionId}`;
  }
  function sectionFromDataset(element) {
    const raw = element.getAttribute("data-za-extra-module") || element.dataset?.zaExtraModule;
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      const id = data?.card?.content?.id ?? data?.content?.id ?? data?.section?.id;
      return /^\d+$/.test(String(id || "")) ? String(id) : null;
    } catch {
      return null;
    }
  }
  function extractColumnLinks(document2, pageUrl, expectedColumnId = null) {
    const pageInfo = inferPaidColumnInfo(document2, pageUrl);
    const columnId = expectedColumnId || pageInfo?.columnId;
    if (!columnId) return [];
    const standardColumn = /^c_\d+$/.test(columnId);
    if (standardColumn && pageInfo?.kind === "section" && pageInfo.sectionId) {
      return [{
        sectionId: pageInfo.sectionId,
        url: canonicalSectionUrl(columnId, pageInfo.sectionId),
        title: detectPageTitle(document2)
      }];
    }
    const links = [];
    const add = (sectionId, title, orderHint = links.length) => {
      if (!/^\d+$/.test(String(sectionId || ""))) return;
      links.push({
        sectionId: String(sectionId),
        url: canonicalSectionUrl(columnId, sectionId),
        title: cleanText(title) || `\u7AE0\u8282 ${sectionId}`,
        orderHint
      });
    };
    for (const anchor of document2.querySelectorAll("a[href]")) {
      let parsed;
      try {
        parsed = parsePaidColumnUrl(new URL(anchor.getAttribute("href"), pageUrl).href);
      } catch {
        continue;
      }
      const belongsToColumn = parsed?.columnId === columnId || standardColumn && parsed?.sectionId && !parsed.columnId;
      if (belongsToColumn && parsed.sectionId) {
        add(parsed.sectionId, titleNear(anchor, parsed.sectionId));
      }
    }
    if (!standardColumn) {
      for (const element of document2.querySelectorAll("[data-za-extra-module]")) {
        const sectionId = sectionFromDataset(element);
        if (sectionId) add(sectionId, titleNear(element, sectionId));
      }
      const markup = document2.documentElement?.innerHTML?.replaceAll("\\/", "/") || "";
      const sectionPattern = new RegExp(`/market/paid_column/${columnId}/section/(\\d+)`, "g");
      for (const match of markup.matchAll(sectionPattern)) add(match[1], `\u7AE0\u8282 ${match[1]}`);
    }
    if (pageInfo?.columnId === columnId && pageInfo.sectionId && !links.some((item) => item.sectionId === pageInfo.sectionId)) {
      add(pageInfo.sectionId, detectPageTitle(document2));
    }
    return uniqueBy(links, (item) => item.sectionId).sort((a, b) => a.orderHint - b.orderHint).map(({ orderHint, ...item }) => item);
  }
  function scoreContent(element) {
    const textLength = cleanText(element.textContent).length;
    if (textLength < 80) return -1;
    const className = String(element.className || "");
    let score = textLength + element.querySelectorAll("p").length * 80 + element.querySelectorAll("img").length * 180;
    if (/RichText/i.test(className)) score += 1e5;
    if (element.tagName === "ARTICLE") score += 8e4;
    if (element.tagName === "MAIN") score += 1e3;
    return score;
  }
  function selectContentRoot(document2) {
    const candidates = [];
    const seen = /* @__PURE__ */ new Set();
    for (const selector of CONTENT_SELECTORS) {
      for (const element of document2.querySelectorAll(selector)) {
        if (seen.has(element)) continue;
        seen.add(element);
        candidates.push({ element, score: scoreContent(element) });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.score >= 0 ? candidates[0].element : null;
  }
  function bestImageSource(image, pageUrl) {
    const source = image.getAttribute("data-original") || image.getAttribute("data-actualsrc") || image.getAttribute("data-src") || image.currentSrc || image.getAttribute("src");
    if (!source || source.startsWith("blob:")) return null;
    try {
      return new URL(source, pageUrl).href;
    } catch {
      return source.startsWith("data:image/") ? source : null;
    }
  }
  function absolutizeLink(anchor, pageUrl) {
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#")) return;
    try {
      const url = new URL(href, pageUrl);
      if (!["https:", "http:", "mailto:"].includes(url.protocol)) {
        anchor.removeAttribute("href");
        return;
      }
      anchor.setAttribute("href", url.href);
    } catch {
      anchor.removeAttribute("href");
    }
  }
  function stripAttributes(root2) {
    for (const element of [root2, ...root2.querySelectorAll("*")]) {
      for (const attribute of [...element.attributes]) {
        const keep = ["href", "src", "alt", "title", "colspan", "rowspan"].includes(attribute.name);
        if (!keep) element.removeAttribute(attribute.name);
      }
    }
  }
  function sanitizeArticleRoot(root2, pageUrl) {
    const clone = root2.cloneNode(true);
    clone.querySelectorAll("[data-tex]").forEach((element) => {
      const tex = cleanText(element.getAttribute("data-tex"));
      if (!tex) return;
      const isBlock2 = element.tagName === "DIV" || /display|block/i.test(String(element.className || ""));
      const replacement = clone.ownerDocument.createElement(isBlock2 ? "div" : "span");
      replacement.textContent = isBlock2 ? `$$
${tex}
$$` : `$${tex}$`;
      element.replaceWith(replacement);
    });
    clone.querySelectorAll("iframe[src],video,audio").forEach((element) => {
      const source = element.getAttribute("src") || element.querySelector("source[src]")?.getAttribute("src");
      if (!source) return;
      let href;
      try {
        href = new URL(source, pageUrl).href;
      } catch {
        return;
      }
      const paragraph = clone.ownerDocument.createElement("p");
      const anchor = clone.ownerDocument.createElement("a");
      anchor.href = href;
      anchor.textContent = "\u67E5\u770B\u539F\u59CB\u5A92\u4F53\u5185\u5BB9";
      paragraph.append(anchor);
      element.replaceWith(paragraph);
    });
    clone.querySelectorAll(REMOVE_SELECTORS.join(",")).forEach((node) => node.remove());
    clone.querySelectorAll("source").forEach((node) => node.remove());
    clone.querySelectorAll("svg").forEach((node) => node.remove());
    clone.querySelectorAll("a[href]").forEach((anchor) => absolutizeLink(anchor, pageUrl));
    const images = [];
    clone.querySelectorAll("img").forEach((image, index) => {
      const url = bestImageSource(image, pageUrl);
      if (!url) {
        image.remove();
        return;
      }
      const placeholder = `__ZHIHU_EXPORT_IMAGE_${index}__`;
      images.push({ placeholder, url, alt: cleanText(image.getAttribute("alt")) });
      image.setAttribute("src", placeholder);
      image.removeAttribute("srcset");
      image.removeAttribute("data-original");
      image.removeAttribute("data-actualsrc");
      image.removeAttribute("data-src");
    });
    stripAttributes(clone);
    return { root: clone, images };
  }
  function hasLockControl(document2) {
    return [...document2.querySelectorAll("button,a,[role='button']")].some((element) => ACCESS_LOCK_PATTERN2.test(cleanText(element.textContent)));
  }
  function probeArticleDocument(document2, pageUrl) {
    const pageInfo = inferPaidColumnInfo(document2, pageUrl);
    if (!pageInfo?.sectionId) return { ok: false };
    const root2 = selectContentRoot(document2);
    if (!root2) return { ok: false };
    const bodyText = cleanText(document2.body?.textContent);
    const textLength = cleanText(root2.textContent).length;
    if (ACCESS_LOCK_PATTERN2.test(bodyText) && (hasLockControl(document2) || textLength < 2e3)) {
      return { ok: false };
    }
    let imageSignature = 0;
    const images = root2.querySelectorAll("img");
    for (const image of images) {
      const source = bestImageSource(image, pageUrl);
      imageSignature += source ? source.length : 1;
    }
    return {
      ok: true,
      sectionId: pageInfo.sectionId,
      fingerprint: [
        pageInfo.sectionId,
        textLength,
        root2.querySelectorAll("p").length,
        images.length,
        imageSignature
      ].join(":")
    };
  }
  function extractArticleDocument(document2, pageUrl, toMarkdown) {
    const pageInfo = inferPaidColumnInfo(document2, pageUrl);
    if (!pageInfo?.sectionId) {
      return { ok: false, reason: "\u5F53\u524D\u9875\u9762\u4E0D\u662F\u4ED8\u8D39\u4E13\u680F\u7AE0\u8282\u9875" };
    }
    const discovered = extractColumnLinks(document2, pageUrl, pageInfo.columnId);
    const root2 = selectContentRoot(document2);
    const bodyText = cleanText(document2.body?.textContent);
    if (!root2) {
      return { ok: false, accessDenied: ACCESS_LOCK_PATTERN2.test(bodyText), reason: "\u6CA1\u6709\u627E\u5230\u7AE0\u8282\u6B63\u6587", discovered };
    }
    const textLength = cleanText(root2.textContent).length;
    const explicitLockControl = hasLockControl(document2);
    if (ACCESS_LOCK_PATTERN2.test(bodyText) && (explicitLockControl || textLength < 2e3)) {
      return { ok: false, accessDenied: true, reason: "\u5F53\u524D\u6D4F\u89C8\u5668\u4F1A\u8BDD\u6CA1\u6709\u663E\u793A\u5B8C\u6574\u6B63\u6587", discovered };
    }
    const { root: cleanRoot, images } = sanitizeArticleRoot(root2, pageUrl);
    const title = detectPageTitle(document2, `\u7AE0\u8282 ${pageInfo.sectionId}`);
    const html = cleanRoot.innerHTML.trim();
    const markdown = toMarkdown(cleanRoot).trim();
    if (markdown.length < 80) {
      return { ok: false, accessDenied: ACCESS_LOCK_PATTERN2.test(bodyText), reason: "\u63D0\u53D6\u5230\u7684\u6B63\u6587\u8FC7\u77ED", discovered };
    }
    return {
      ok: true,
      columnId: pageInfo.columnId,
      sectionId: pageInfo.sectionId,
      title,
      url: pageInfo.columnId ? canonicalSectionUrl(pageInfo.columnId, pageInfo.sectionId) : new URL(pageUrl).href,
      html,
      markdown,
      images,
      discovered
    };
  }

  // src/cached-article.js
  function extractColumnArticleItem(item, columnId, hostDocument, toMarkdown) {
    const normalized = normalizeColumnArticleItem(item, columnId);
    if (!normalized.ok) return normalized;
    const articleDocument = hostDocument.implementation.createHTMLDocument(normalized.title);
    articleDocument.title = normalized.title;
    const heading = articleDocument.createElement("h1");
    heading.textContent = normalized.title;
    const columnLink = articleDocument.createElement("a");
    columnLink.href = `https://www.zhihu.com/column/${columnId}`;
    columnLink.textContent = "\u6240\u5C5E\u4E13\u680F";
    const article = articleDocument.createElement("article");
    article.className = "RichText";
    article.innerHTML = normalized.content;
    articleDocument.body.append(heading, columnLink, article);
    const result = extractArticleDocument(articleDocument, normalized.url, toMarkdown);
    return {
      ...result,
      columnId,
      sectionId: normalized.sectionId,
      title: normalized.title,
      url: normalized.url,
      requiresAccessValidation: normalized.requiresAccessValidation
    };
  }

  // src/catalog-api.js
  var DEFAULT_PAGE_SIZE = 20;
  var DEFAULT_MAX_PAGES = 2e3;
  var API_ORIGINS2 = /* @__PURE__ */ new Set(["https://www.zhihu.com", "https://zhuanlan.zhihu.com"]);
  function nonNegativeInteger(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }
  function normalizeApiOrigin(value) {
    const origin = String(value || "https://www.zhihu.com").replace(/\/+$/, "");
    if (!API_ORIGINS2.has(origin)) throw new TypeError("\u76EE\u5F55\u63A5\u53E3\u57DF\u540D\u4E0D\u53D7\u4FE1\u4EFB");
    return origin;
  }
  function apiPath(columnId, apiOrigin) {
    return apiOrigin === "https://zhuanlan.zhihu.com" ? `/api/columns/${columnId}/articles` : `/api/v4/columns/${columnId}/articles`;
  }
  function columnArticlesApiUrl(columnId, offset = 0, limit = DEFAULT_PAGE_SIZE, apiOrigin = "https://www.zhihu.com") {
    if (!/^c_\d+$/.test(String(columnId || ""))) {
      throw new TypeError("\u6807\u51C6\u77E5\u4E4E\u4E13\u680F ID \u5FC5\u987B\u4EE5 c_ \u5F00\u5934");
    }
    const safeOffset = nonNegativeInteger(offset);
    const safeLimit = nonNegativeInteger(limit);
    if (safeOffset === null || !safeLimit) throw new TypeError("\u76EE\u5F55\u5206\u9875\u53C2\u6570\u65E0\u6548");
    const origin = normalizeApiOrigin(apiOrigin);
    const params = new URLSearchParams({ limit: String(safeLimit), offset: String(safeOffset) });
    return `${origin}${apiPath(columnId, origin)}?${params}`;
  }
  function articleFromItem(item, columnId) {
    const source = item?.target || item?.article || item;
    const sectionId = sectionIdFromArticleItem(item);
    if (!sectionId) return null;
    const title = String(source?.title ?? item?.title ?? `\u6587\u7AE0 ${sectionId}`).replace(/\s+/g, " ").trim();
    return {
      sectionId,
      url: canonicalSectionUrl(columnId, sectionId),
      title: title || `\u6587\u7AE0 ${sectionId}`,
      requiresAccessProbe: source?.content_need_truncated === true
    };
  }
  function nextOffsetFromPaging(paging, columnId, apiOrigin, currentOffset) {
    if (!paging?.next) return { offset: null, invalid: false };
    try {
      const origin = normalizeApiOrigin(apiOrigin);
      const url = new URL(paging.next, origin);
      const expectedHost = new URL(origin).hostname;
      if (url.hostname !== expectedHost || !["http:", "https:"].includes(url.protocol) || url.pathname !== apiPath(columnId, origin)) {
        return { offset: null, invalid: true };
      }
      const offset = nonNegativeInteger(url.searchParams.get("offset"));
      return { offset: offset !== null && offset > currentOffset ? offset : null, invalid: offset === null || offset <= currentOffset };
    } catch {
      return { offset: null, invalid: true };
    }
  }
  function parseColumnArticlesPage(payload, columnId, currentOffset = 0, apiOrigin = "https://www.zhihu.com") {
    const data = Array.isArray(payload?.data) ? payload.data : [];
    const links = data.map((item) => articleFromItem(item, columnId)).filter(Boolean);
    const paging = payload?.paging || {};
    const total = nonNegativeInteger(paging.totals);
    const next2 = nextOffsetFromPaging(paging, columnId, apiOrigin, currentOffset);
    return {
      links,
      rawItemCount: data.length,
      total,
      isEnd: paging.is_end === true,
      nextOffset: next2.offset,
      invalidNext: next2.invalid
    };
  }
  async function fetchAllColumnArticles({
    columnId,
    requestPage,
    pageSize = DEFAULT_PAGE_SIZE,
    maxPages = DEFAULT_MAX_PAGES,
    apiOrigin = "https://www.zhihu.com",
    onPage = null
  }) {
    if (typeof requestPage !== "function") throw new TypeError("requestPage \u5FC5\u987B\u662F\u51FD\u6570");
    const collected = /* @__PURE__ */ new Map();
    const visitedOffsets = /* @__PURE__ */ new Set();
    let offset = 0;
    let expectedCount = null;
    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      if (visitedOffsets.has(offset)) throw new Error(`\u76EE\u5F55\u63A5\u53E3\u8FD4\u56DE\u4E86\u91CD\u590D\u5206\u9875\u4F4D\u7F6E\uFF1A${offset}`);
      visitedOffsets.add(offset);
      const url = columnArticlesApiUrl(columnId, offset, pageSize, apiOrigin);
      const payload = await requestPage(url, { offset, pageNumber, pageSize });
      const page = parseColumnArticlesPage(payload, columnId, offset, apiOrigin);
      if (page.total !== null) expectedCount = page.total;
      for (const link of page.links) {
        if (!collected.has(link.sectionId)) collected.set(link.sectionId, link);
      }
      await onPage?.({
        pageNumber,
        offset,
        discoveredCount: collected.size,
        expectedCount,
        isEnd: page.isEnd
      });
      const reachedExpectedCount = expectedCount !== null && collected.size >= expectedCount;
      if (page.isEnd || reachedExpectedCount) {
        if (expectedCount !== null && collected.size !== expectedCount) {
          throw new Error(`\u76EE\u5F55\u63A5\u53E3\u62A5\u544A ${expectedCount} \u7BC7\uFF0C\u4F46\u53EA\u53D1\u73B0 ${collected.size} \u7BC7`);
        }
        return {
          links: [...collected.values()],
          expectedCount: expectedCount ?? collected.size,
          pageCount: pageNumber,
          complete: true
        };
      }
      if (page.rawItemCount === 0) {
        throw new Error(`\u76EE\u5F55\u5728\u7B2C ${pageNumber} \u9875\u63D0\u524D\u8FD4\u56DE\u7A7A\u6570\u636E`);
      }
      if (page.invalidNext) throw new Error(`\u76EE\u5F55\u63A5\u53E3\u8FD4\u56DE\u4E86\u65E0\u6548\u7684\u4E0B\u4E00\u9875\u5730\u5740\uFF1A${offset}`);
      const fallbackOffset = offset + page.rawItemCount;
      const nextOffset = page.nextOffset ?? fallbackOffset;
      if (nextOffset <= offset) throw new Error(`\u76EE\u5F55\u5206\u9875\u6CA1\u6709\u7EE7\u7EED\u524D\u8FDB\uFF1A${offset}`);
      offset = nextOffset;
    }
    throw new Error(`\u76EE\u5F55\u8D85\u8FC7 ${maxPages} \u9875\uFF0C\u5DF2\u505C\u6B62\u4EE5\u907F\u514D\u65E0\u9650\u8BF7\u6C42`);
  }

  // src/concurrency.js
  async function mapWithConcurrency(items, concurrency, operation) {
    if (!Number.isInteger(concurrency) || concurrency < 1) throw new TypeError("\u5E76\u53D1\u6570\u5FC5\u987B\u662F\u6B63\u6574\u6570");
    if (typeof operation !== "function") throw new TypeError("\u5E76\u53D1\u4EFB\u52A1\u5FC5\u987B\u662F\u51FD\u6570");
    const results = new Array(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await operation(items[index], index);
      }
    });
    await Promise.all(workers);
    return results;
  }

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

  // src/content.js
  var turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*"
  });
  turndown.use(gfm);
  function visible(element) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }
  async function clickMatchingButtons(pattern) {
    const candidates = [...document.querySelectorAll("button,[role='button']")].filter(visible).filter((element) => pattern.test((element.textContent || "").trim()));
    for (const element of candidates.slice(0, 4)) {
      element.click();
      await sleep(250);
    }
  }
  async function scrollElement(element, maximumSteps = 18, onStep = null, delayMs = 220) {
    let unchanged = 0;
    let previousHeight = 0;
    for (let step = 0; step < maximumSteps && unchanged < 5; step += 1) {
      const height = element === document.scrollingElement ? document.documentElement.scrollHeight : element.scrollHeight;
      if (height === previousHeight) unchanged += 1;
      else unchanged = 0;
      previousHeight = height;
      element.scrollTo?.({ top: height, behavior: "instant" });
      await sleep(delayMs);
      if (onStep) await onStep();
    }
  }
  async function preparePage(mode, onStep = null) {
    if (mode === "discover") {
      await clickMatchingButtons(/^(目录|全部章节|全部文章|查看全部|查看更多|加载更多|展开目录)$/);
    }
    const scrollables = [...document.querySelectorAll("main,aside,div,section")].filter((element) => visible(element) && element.clientHeight > 180 && element.scrollHeight > element.clientHeight * 1.3).filter((element) => element.querySelector('[class*="ChapterItem"],a[href*="/market/paid_column/"],a[href*="zhuanlan.zhihu.com/p/"],a[href^="/p/"]')).slice(0, 3);
    const delayMs = mode === "discover" ? 420 : 220;
    for (const element of scrollables) await scrollElement(element, 24, onStep, delayMs);
    await scrollElement(document.scrollingElement || document.documentElement, mode === "discover" ? 36 : 14, onStep, delayMs);
    await sleep(500);
  }
  async function discoverPage() {
    let pageInfo = inferPaidColumnInfo(document, location.href);
    const collected = /* @__PURE__ */ new Map();
    const collect = async () => {
      pageInfo = pageInfo || inferPaidColumnInfo(document, location.href);
      if (!pageInfo?.columnId) return;
      for (const link of extractColumnLinks(document, location.href, pageInfo.columnId)) {
        if (!collected.has(link.sectionId)) collected.set(link.sectionId, link);
      }
      await clickMatchingButtons(/^(查看更多|加载更多)$/);
    };
    let catalogComplete = null;
    let expectedCount = null;
    let discoveryError = "";
    if (/^c_\d+$/.test(String(pageInfo?.columnId || ""))) {
      try {
        const apiResult = await fetchAllColumnArticles({
          columnId: pageInfo.columnId,
          apiOrigin: location.hostname === "zhuanlan.zhihu.com" ? "https://zhuanlan.zhihu.com" : "https://www.zhihu.com",
          requestPage: async (url) => retryOperation(async () => {
            const response = await fetch(url, {
              credentials: "include",
              cache: "no-store",
              headers: { Accept: "application/json" }
            });
            if (!response.ok) throw new Error(`\u76EE\u5F55\u63A5\u53E3\u8FD4\u56DE HTTP ${response.status}`);
            const payload = await response.json();
            if (payload?.error) throw new Error(payload.error.message || "\u76EE\u5F55\u63A5\u53E3\u62D2\u7EDD\u8BBF\u95EE");
            return payload;
          }, { attempts: 3, delays: [500, 1400] }),
          onPage: async () => sleep(80)
        });
        for (const link of apiResult.links) collected.set(link.sectionId, link);
        catalogComplete = apiResult.complete;
        expectedCount = apiResult.expectedCount;
      } catch (error) {
        catalogComplete = false;
        discoveryError = error?.message || String(error);
      }
    }
    if (catalogComplete) {
      return {
        ok: true,
        columnId: pageInfo.columnId,
        sectionId: pageInfo.sectionId,
        columnTitle: detectPageTitle(document),
        pageUrl: location.href,
        links: [...collected.values()],
        catalogComplete,
        expectedCount,
        discoveryError,
        articleApiAvailable: true
      };
    }
    await collect();
    await preparePage("discover", collect);
    await collect();
    if (!pageInfo) return { ok: false, reason: "\u5F53\u524D\u9875\u9762\u4E2D\u6CA1\u6709\u53D1\u73B0\u4ED8\u8D39\u4E13\u680F\u76EE\u5F55\u6216\u7AE0\u8282\u4FE1\u606F" };
    const links = [...collected.values()];
    return {
      ok: true,
      columnId: pageInfo.columnId,
      sectionId: pageInfo.sectionId,
      columnTitle: detectPageTitle(document),
      pageUrl: location.href,
      links,
      catalogComplete,
      expectedCount,
      discoveryError,
      articleApiAvailable: false
    };
  }
  async function extractPage(message = {}) {
    const extract = () => extractArticleDocument(document, location.href, (root2) => turndown.turndown(root2));
    if (message.settled === true) return extract();
    return waitForArticleExtraction({
      probe: () => probeArticleDocument(document, location.href),
      extract,
      wait: sleep,
      emptyLimit: 12
    });
  }
  function probePage() {
    const probe = probeArticleDocument(document, location.href);
    return {
      ok: true,
      sectionId: probe.ok ? probe.sectionId : "",
      fingerprint: probe.ok ? probe.fingerprint : ""
    };
  }
  function extractApiArticle(item, columnId) {
    return extractColumnArticleItem(item, columnId, document, (root2) => turndown.turndown(root2));
  }
  async function authenticatedArticleDetail(sectionId, columnId, apiOrigin = location.origin) {
    let lastResult = null;
    try {
      return await retryOperation(async () => {
        const result = await fetchArticleDetail({
          sectionId,
          columnId,
          apiOrigin,
          credentials: "include"
        });
        lastResult = result;
        if (result.retryable) {
          const error = new Error(result.reason || "\u6587\u7AE0\u63A5\u53E3\u6682\u65F6\u4E0D\u53EF\u7528");
          error.articleResult = result;
          throw error;
        }
        return result;
      }, { attempts: 2, delays: [700] });
    } catch (error) {
      return error?.articleResult || lastResult || {
        ok: false,
        sectionId,
        reason: error?.message || String(error)
      };
    }
  }
  async function extractApiArticleById(sectionId, columnId, apiOrigin) {
    const detail = await authenticatedArticleDetail(sectionId, columnId, apiOrigin);
    if (!detail.ok) return { ...detail, sectionId };
    try {
      return extractApiArticle(detail, columnId);
    } catch (error) {
      return { ok: false, sectionId, reason: error?.message || String(error) };
    }
  }
  async function probeArticleApi(message) {
    const columnId = String(message.columnId || "");
    const sectionId = String(message.sectionId || "");
    if (!/^c_\d+$/.test(columnId) || !/^\d+$/.test(sectionId)) {
      return { ok: false, reason: "\u6587\u7AE0\u63A5\u53E3\u63A2\u9488\u53C2\u6570\u65E0\u6548" };
    }
    const alternateOrigin = location.origin === "https://www.zhihu.com" ? "https://zhuanlan.zhihu.com" : "https://www.zhihu.com";
    const failures = [];
    let accessDeniedOnly = true;
    let truncatedOnly = true;
    const noteFailure = (apiOrigin, result) => {
      if (!result?.accessDenied) accessDeniedOnly = false;
      if (!result?.truncated) truncatedOnly = false;
      failures.push(`${new URL(apiOrigin).hostname}\uFF1A${result?.reason || "\u6587\u7AE0\u63A5\u53E3\u4E0D\u53EF\u7528"}`);
    };
    for (const apiOrigin of [location.origin, alternateOrigin]) {
      const anonymous = await fetchArticleDetail({
        sectionId,
        columnId,
        apiOrigin,
        credentials: "omit"
      });
      if (anonymous.retryable) {
        noteFailure(apiOrigin, { reason: anonymous.reason });
        continue;
      }
      if (!anonymous.accessDenied) {
        noteFailure(apiOrigin, { reason: "\u533F\u540D\u8BF7\u6C42\u672A\u88AB\u62D2\u7EDD" });
        continue;
      }
      const authenticated = await authenticatedArticleDetail(sectionId, columnId, apiOrigin);
      if (!authenticated.ok) {
        noteFailure(apiOrigin, authenticated);
        continue;
      }
      const article = extractApiArticle(authenticated, columnId);
      if (!article.ok) {
        noteFailure(apiOrigin, article);
        continue;
      }
      return {
        ok: true,
        anonymousDenied: anonymous.accessDenied === true,
        apiOrigin,
        article
      };
    }
    return {
      ok: false,
      accessDenied: accessDeniedOnly && failures.length > 0,
      truncated: truncatedOnly && failures.length > 0,
      reason: failures.join("\uFF1B") || "\u767B\u5F55\u6001\u6587\u7AE0\u63A5\u53E3\u4E0D\u53EF\u7528"
    };
  }
  async function extractApiArticles(message) {
    const columnId = String(message.columnId || "");
    const apiOrigin = String(message.apiOrigin || location.origin);
    const sectionIds = Array.isArray(message.sectionIds) ? message.sectionIds.map(String) : [];
    if (!/^c_\d+$/.test(columnId) || !sectionIds.length || sectionIds.length > 20 || sectionIds.some((id) => !/^\d+$/.test(id))) {
      return { ok: false, reason: "\u6B63\u6587\u6279\u6B21\u53C2\u6570\u65E0\u6548" };
    }
    const articles = await mapWithConcurrency(
      sectionIds,
      4,
      (sectionId) => extractApiArticleById(sectionId, columnId, apiOrigin)
    );
    return { ok: true, articles };
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || ![
      "PING",
      "DISCOVER_COLUMN",
      "PROBE_ARTICLE",
      "EXTRACT_ARTICLE",
      "PROBE_ARTICLE_API",
      "EXTRACT_API_ARTICLES"
    ].includes(message.type)) return false;
    if (message.type === "PING") {
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === "PROBE_ARTICLE") {
      sendResponse(probePage());
      return false;
    }
    const operation = message.type === "DISCOVER_COLUMN" ? discoverPage() : message.type === "PROBE_ARTICLE_API" ? probeArticleApi(message) : message.type === "EXTRACT_API_ARTICLES" ? extractApiArticles(message) : extractPage(message);
    operation.then(sendResponse).catch((error) => sendResponse({ ok: false, reason: error?.message || String(error) }));
    return true;
  });
})();
