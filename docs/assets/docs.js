(function () {
  var toggle = document.querySelector(".sidebar-toggle");
  var sidebar = document.getElementById("sidebar");
  if (toggle && sidebar) {
    function mq() {
      var mobile = window.matchMedia("(max-width: 900px)").matches;
      toggle.hidden = !mobile;
      if (!mobile) {
        sidebar.classList.remove("open");
        document.body.classList.remove("sidebar-open");
      }
    }

    toggle.addEventListener("click", function () {
      sidebar.classList.toggle("open");
      document.body.classList.toggle("sidebar-open");
    });

    mq();
    window.addEventListener("resize", mq);
  }

  var input = document.getElementById("doc-search");
  var results = document.getElementById("search-results");
  if (!input || !results) return;

  var index = null;
  var loading = null;

  function load() {
    if (index) return Promise.resolve(index);
    if (!loading) {
      loading = fetch("search-index.json")
        .then(function (res) {
          return res.ok ? res.json() : [];
        })
        .catch(function () {
          return [];
        })
        .then(function (rows) {
          index = rows;
          return rows;
        });
    }
    return loading;
  }

  function score(row, q) {
    var label = row.label.toLowerCase();
    var heading = (row.heading || "").toLowerCase();
    var section = (row.section || "").toLowerCase();
    var slug = row.slug.toLowerCase();
    var best = -1;
    if (label === q) best = 100;
    else if (label.indexOf(q) === 0) best = 80;
    else if (label.indexOf(q) !== -1) best = 60;
    if (heading === q) best = Math.max(best, 90);
    else if (heading.indexOf(q) !== -1) best = Math.max(best, 50);
    if (best < 0 && section.indexOf(q) !== -1) best = 30;
    if (best < 0 && slug.indexOf(q) !== -1) best = 20;
    return best;
  }

  function render(rows) {
    if (!rows.length) {
      results.hidden = true;
      results.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
      return;
    }
    results.innerHTML = "";
    var seen = {};
    rows.forEach(function (row) {
      var href = row.slug + ".html" + (row.hash ? "#" + row.hash : "");
      if (seen[href]) return;
      seen[href] = true;
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = href;
      var title = row.heading ? row.heading : row.label;
      a.textContent = title;
      var context = row.section
        ? row.section + (row.heading ? " · " + row.label : "")
        : "Docs";
      var span = document.createElement("span");
      span.className = "search-context";
      span.textContent = context;
      li.appendChild(a);
      li.appendChild(span);
      results.appendChild(li);
    });
    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function update() {
    var q = input.value.trim().toLowerCase();
    if (q.length < 2) {
      render([]);
      return;
    }
    load().then(function (rows) {
      var scored = [];
      for (var i = 0; i < rows.length; i++) {
        var s = score(rows[i], q);
        if (s > 0) scored.push({ row: rows[i], score: s });
      }
      scored.sort(function (a, b) {
        return b.score - a.score;
      });
      render(
        scored.slice(0, 8).map(function (item) {
          return item.row;
        }),
      );
    });
  }

  input.addEventListener("input", update);
  input.addEventListener("focus", update);
  input.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      input.value = "";
      render([]);
    }
  });
  document.addEventListener("click", function (event) {
    if (!sidebar || sidebar.contains(event.target)) return;
    render([]);
  });

  window.addEventListener("keydown", function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "k") {
      event.preventDefault();
      input.focus();
    }
  });
})();

/* ------------------------------------------------------------------ *
 * Mermaid diagrams.
 *
 * The generator emits `<div class="mermaid">` blocks. Without mermaid the
 * diagram text just sits there as a code block, so we load a pinned build
 * from a CDN and render them into SVG. If the CDN is unreachable the raw
 * text stays, so nothing breaks silently into an empty box.
 * ------------------------------------------------------------------ */
(function () {
  var nodes = document.querySelectorAll(".mermaid");
  if (!nodes.length) return;

  var SRC = "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js";

  function load() {
    return new Promise(function (resolve, reject) {
      if (window.mermaid) return resolve(window.mermaid);
      var existing = document.querySelector('script[data-mermaid]');
      if (existing) {
        existing.addEventListener("load", function () { resolve(window.mermaid); });
        existing.addEventListener("error", reject);
        return;
      }
      var script = document.createElement("script");
      script.src = SRC;
      script.async = true;
      script.setAttribute("data-mermaid", "");
      script.addEventListener("load", function () { resolve(window.mermaid); });
      script.addEventListener("error", reject);
      document.head.appendChild(script);
    });
  }

  load()
    .then(function (mermaid) {
      var css = getComputedStyle(document.documentElement);
      var text = css.getPropertyValue("--text").trim() || "#1b1f24";
      var muted = css.getPropertyValue("--text-secondary").trim() || "#5c6570";
      var accent = css.getPropertyValue("--accent").trim() || "#0969da";
      var bg = css.getPropertyValue("--bg-subtle").trim() || "#f8f9fb";

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        themeVariables: {
          primaryColor: bg,
          primaryTextColor: text,
          primaryBorderColor: accent,
          lineColor: muted,
          secondaryColor: bg,
          tertiaryColor: bg,
          fontSize: "14px",
        },
      });

      return mermaid.run({ nodes: Array.prototype.slice.call(nodes) });
    })
    .catch(function () {
      /* keep the raw diagram text */
    });
})();

/* ------------------------------------------------------------------ *
 * Syntax highlighting for JavaScript, TypeScript and JSON blocks.
 *
 * The shell blocks are coloured at build time and skipped here. This is a
 * tiny dependency-free tokenizer, enough for docs snippets, not a parser.
 * ------------------------------------------------------------------ */
(function () {
  var KEYWORDS = {};
  (
    "await async break case catch class const continue default delete do else " +
    "export extends finally for from function get if import in instanceof let " +
    "new of return set static super switch this throw try typeof var void " +
    "while yield as is keyof infer readonly declare type interface enum " +
    "implements namespace public private protected abstract"
  )
    .split(/\s+/)
    .forEach(function (word) {
      if (word) KEYWORDS[word] = true;
    });

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function span(cls, value) {
    return '<span class="' + cls + '">' + escapeHtml(value) + "</span>";
  }

  var JS_RE = new RegExp(
    [
      "(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)", // 1 comments
      "(`(?:\\\\.|[^`\\\\])*`|\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*')", // 2 strings
      "\\b(0[xX][0-9a-fA-F]+|\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)\\b", // 3 numbers
      "\\b([A-Za-z_$][\\w$]*)\\b", // 4 words
      "([{}()\\[\\];,.:?=<>+\\-*/%!&|]+)", // 5 punctuation
    ].join("|"),
    "g",
  );

  function highlightJs(code) {
    return code.replace(JS_RE, function (match, comment, str, num, word, punc, offset) {
      if (comment) return span("tok-com", comment);
      if (str) return span("tok-str", str);
      if (num) return span("tok-num", num);
      if (word) {
        if (KEYWORDS[word]) return span("tok-kw", word);
        if (/^[A-Z]/.test(word)) return span("tok-typ", word);
        var after = code.slice(offset + match.length).replace(/^\s*/, "");
        if (after.charAt(0) === "(") return span("tok-fn", word);
        if (word === "true" || word === "false" || word === "null" || word === "undefined") {
          return span("tok-lit", word);
        }
        return escapeHtml(word);
      }
      if (punc) return span("tok-punc", punc);
      return escapeHtml(match);
    });
  }

  var JSON_RE = /("(?:\\.|[^"\\])*")(\s*:)?|(\btrue\b|\bfalse\b|\bnull\b)|(-?\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g;

  function highlightJson(code) {
    return code.replace(JSON_RE, function (match, str, colon, lit, num) {
      if (str !== undefined) {
        var key = colon !== undefined;
        return span(key ? "tok-prop" : "tok-str", str) + (colon ? span("tok-punc", ":") : "");
      }
      if (lit) return span("tok-lit", lit);
      if (num) return span("tok-num", num);
      return escapeHtml(match);
    });
  }

  var blocks = document.querySelectorAll("pre:not(.shell-block) > code[class*='language-']");
  Array.prototype.forEach.call(blocks, function (code) {
    var cls = code.className || "";
    var lang = (cls.match(/language-([\w-]+)/) || [])[1];
    if (!lang) return;
    lang = lang.toLowerCase();
    var text = code.textContent;
    var html;
    if (lang === "json" || lang === "jsonc") {
      html = highlightJson(text);
    } else if (["js", "jsx", "ts", "tsx", "javascript", "typescript", "mjs", "cjs"].indexOf(lang) !== -1) {
      html = highlightJs(text);
    } else {
      return;
    }
    code.innerHTML = html;
  });
})();
