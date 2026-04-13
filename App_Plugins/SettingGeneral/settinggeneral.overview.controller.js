angular.module("umbraco").controller("Test13.SettingGeneral.Overview", [
  "$scope",
  "$http",
  "$q",
  "umbRequestHelper",
  "notificationsService",
  "$timeout",
  function ($scope, $http, $q, umbRequestHelper, notificationsService, $timeout) {
    var defaultContainerScss = [
      ".container {",
      "  position: relative;",
      "  width: 100%;",
      "  padding: 0 15px;",
      "  margin: 0 auto;",
      "  z-index: 1;",
      "",
      "  @media (min-width: 48px) {",
      "    //768px",
      "    max-width: 100rem;",
      "  }",
      "",
      "  @media (min-width: 62rem) {",
      "    //992px",
      "    max-width: 110rem;",
      "  }",
      "",
      "  @media (min-width: 75rem) {",
      "    //1200px",
      "    max-width: 130rem;",
      "  }",
      "",
      "  @media (min-width: 87.5rem) {",
      "    //1400px",
      "    max-width: 129rem;",
      "  }",
      "  @media (min-width: 93.75rem) {",
      "    //1500px",
      "    max-width: 140rem;",
      "  }",
      "  @media (min-width: 100rem) {",
      "    //1600px",
      "    max-width: 150rem;",
      "  }",
      "  @media (min-width: 106.25rem) {",
      "    //1700px",
      "    max-width: 166.8rem;",
      "  }",
      "}",
    ].join("\n");

    var defaults = {
      tagline: "",
      faviconVersion: "",
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      primaryColor: "#1a1a2e",
      secondaryColor: "#16213e",
      accentColor: "#e94560",
      customCss: "",
      userCss: "",
      userJs: "",
      useRem10px: false,
      contentWrapperClass: "box-padding",
      containerScss: defaultContainerScss,
      boxPadding: {
        minPaddingInlinePx: 15,
        maxPaddingInlinePx: 300,
        minFluidViewportPx: 870,
        maxFluidViewportPx: 1820,
      },
    };

    $scope.settings = angular.extend({}, defaults);
    $scope.loading = true;

    // Accordion state for settings cards
    $scope.cardOpen = {
      siteIdentity: true,
      siteAppearance: true,
      contentWrapper: true,
      customCss: true,
      customJs: true,
    };

    $scope.isCardOpen = function (key) {
      return !!($scope.cardOpen && $scope.cardOpen[key]);
    };

    $scope.toggleCard = function (key) {
      if (!$scope.cardOpen) $scope.cardOpen = {};
      $scope.cardOpen[key] = !$scope.cardOpen[key];
    };

    $scope.fontSelection = "";
    $scope.customFont = "";
    $scope.fontFamilyUploadName = "";
    $scope.uploadingFont = false;
    $scope.uploadingFavicon = false;

    $scope.isCustomFontSelection = function () {
      return String($scope.fontSelection || "") === "__custom__";
    };

    var FONT_UPLOAD_MARK_START = "/* __site_font_upload_start__ */";
    var FONT_UPLOAD_MARK_END = "/* __site_font_upload_end__ */";

    function stripGeneratedFontFace(css) {
      if (!css || typeof css !== "string") return "";
      var start = css.indexOf(FONT_UPLOAD_MARK_START);
      var end = css.indexOf(FONT_UPLOAD_MARK_END);
      if (start === -1 || end === -1 || end < start) return css;
      return (css.slice(0, start) + css.slice(end + FONT_UPLOAD_MARK_END.length))
        .replace(/^\s+|\s+$/g, "");
    }

    function cssEscapeFontNameForQuotes(name) {
      if (!name || typeof name !== "string") return "CustomFont";
      return name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    }

    function toRelativeFontUrlForCss(relativeUrl) {
      if (!relativeUrl || typeof relativeUrl !== "string") return "";
      if (relativeUrl.indexOf("/fonts/") === 0) {
        return "../../fonts/" + relativeUrl.substring("/fonts/".length);
      }
      return relativeUrl;
    }

    function inferWeightStyleFromStem(stem) {
      if (!stem || typeof stem !== "string") {
        return { weight: 400, fontStyle: "normal" };
      }
      var italic = /(?:^|-)(italic|oblique)(?:-|$)/i.test(stem) || /italic/i.test(stem);
      var s = stem.toLowerCase();
      var t = s
        .replace(/italic|oblique/gi, " ")
        .replace(/-/g, " ")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      var weight = 400;
      if (/\bblack\b|heavy|900\b/.test(t)) weight = 900;
      else if (/extrabold|ultrabold|800/.test(t)) weight = 800;
      else if (/\bbold\b/.test(t) && !/semi|demi/.test(t)) weight = 700;
      else if (/semibold|demibold|600/.test(t)) weight = 600;
      else if (/medium|500/.test(t)) weight = 500;
      else if (/regular|normal|book/.test(t)) weight = 400;
      else if (/light|300/.test(t)) weight = 300;
      else if (/extralight|thin|200|100/.test(t)) weight = 200;
      return { weight: weight, fontStyle: italic ? "italic" : "normal" };
    }

    function buildMultiFontFaceBlocks(cssFamilyDisplay, fileInfos) {
      var quoted = '"' + cssEscapeFontNameForQuotes(String(cssFamilyDisplay || "CustomFont").trim()) + '"';
      var lines = [FONT_UPLOAD_MARK_START];
      for (var i = 0; i < fileInfos.length; i++) {
        var info = fileInfos[i];
        var stem = info.stem || String(info.fileName || "").replace(/\.[^.]+$/, "");
        var ws = inferWeightStyleFromStem(stem);
        var cssUrl = toRelativeFontUrlForCss(info.relativeUrl);
        var fmt = String(info.format || "woff").replace(/"/g, '\\"');
        lines.push("@font-face {");
        lines.push("  font-family: " + quoted + ";");
        lines.push(
          '  src: url("' + cssUrl.replace(/"/g, '\\"') + '") format("' + fmt + '");'
        );
        lines.push("  font-style: " + ws.fontStyle + ";");
        lines.push("  font-weight: " + ws.weight + ";");
        lines.push("  font-display: swap;");
        lines.push("}");
        lines.push("");
      }
      lines.push(FONT_UPLOAD_MARK_END);
      return lines.join("\n");
    }

    function mergeFontFaceIntoCustomCss(css, block) {
      var rest = stripGeneratedFontFace(css || "");
      if (!rest) return block;
      return block + "\n\n" + rest;
    }

    function generalSettingsApiUrl(actionName) {
      var url;
      try {
        url = umbRequestHelper.getApiUrl("generalSettingsApi", actionName, "");
      } catch (ignore) {
        url = null;
      }
      if (url) return url;
      var sv = Umbraco.Sys.ServerVariables;
      var base =
        (sv.umbracoSettings && sv.umbracoSettings.umbracoPath) || "/umbraco";
      if (typeof base !== "string") base = "/umbraco";
      base = base.replace(/\/+$/, "");
      return (
        base + "/backoffice/api/GeneralSettingsApi/" + encodeURIComponent(actionName)
      );
    }

    function getCookie(name) {
      var match = document.cookie.match(
        new RegExp(
          "(?:^|; )" +
            name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, "\\$1") +
            "=([^;]*)"
        )
      );
      return match ? decodeURIComponent(match[1]) : "";
    }

    function parseUmbracoBackOfficeJson(text) {
      var s = String(text).trim();
      try {
        return JSON.parse(s);
      } catch (ignore) {
        s = s.replace(/^\)\]\}',?\r?\n/, "");
        return JSON.parse(s);
      }
    }

    function postMultipartFormData(url, formData) {
      return $q(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);
        xhr.withCredentials = true;
        xhr.setRequestHeader("Accept", "application/json");
        var xsrf = getCookie("UMB-XSRF-TOKEN");
        if (xsrf) {
          xhr.setRequestHeader("X-UMB-XSRF-TOKEN", xsrf);
        }
        xhr.onload = function () {
          var raw = xhr.responseText || "";
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              var data = parseUmbracoBackOfficeJson(raw);
              resolve({ data: data, status: xhr.status });
            } catch (e) {
              reject({
                status: xhr.status,
                data: raw,
                message: e && e.message,
              });
            }
          } else {
            reject({ status: xhr.status, data: raw });
          }
        };
        xhr.onerror = function () {
          reject({ status: xhr.status || 0, data: null });
        };
        xhr.send(formData);
      });
    }

    $scope.triggerCustomFontFilePicker = function () {
      var el = document.getElementById("tg-font-upload");
      if (el) el.click();
    };

    $scope.onCustomFontFileChosen = function (inputEl) {
      var files = inputEl && inputEl.files;
      if (!files || !files.length) return;

      var fileArray = [];
      for (var j = 0; j < files.length; j++) {
        fileArray.push(files[j]);
      }

      var fd = new FormData();
      fd.append("familyName", ($scope.fontFamilyUploadName || "").trim());
      for (var i = 0; i < fileArray.length; i++) {
        fd.append("files", fileArray[i]);
      }
      if (inputEl) inputEl.value = "";

      $scope.uploadingFont = true;
      postMultipartFormData(generalSettingsApiUrl("UploadFonts"), fd)
        .then(function (res) {
          var data = res.data || {};
          if (!data.files || !data.files.length) {
            notificationsService.error("Upload", "Invalid response from server.");
            return;
          }
          var cssFamily =
            ($scope.fontFamilyUploadName || "").trim() ||
            data.familyName ||
            "CustomFont";
          var block = buildMultiFontFaceBlocks(cssFamily, data.files);
          $scope.settings.customCss = mergeFontFaceIntoCustomCss(
            $scope.settings.customCss,
            block
          );
          $scope.customFont = '"' + cssEscapeFontNameForQuotes(cssFamily) + '", sans-serif';
          // Ensure the uploaded font becomes the active font-family immediately.
          // Otherwise the config can end up saving the previous preset stack.
          $scope.settings.fontFamily = $scope.customFont;
          if ($scope.fontSelection !== "__custom__") {
            $scope.fontSelection = "__custom__";
          }
          return $scope.save();
        })
        .catch(function (res) {
          var msg =
            (res.data && (res.data.error || res.data.message)) ||
            (res.status ? "HTTP " + res.status : "Upload failed.");
          notificationsService.error("Upload font", msg);
        })
        .finally(function () {
          $scope.uploadingFont = false;
        });
    };

    $scope.triggerFaviconPicker = function () {
      var el = document.getElementById("tg-favicon-upload");
      if (el) el.click();
    };

    $scope.onFaviconChosen = function (inputEl) {
      var files = inputEl && inputEl.files;
      if (!files || !files.length) return;
      var file = files[0];
      if (inputEl) inputEl.value = "";

      var fd = new FormData();
      fd.append("file", file);

      $scope.uploadingFavicon = true;
      postMultipartFormData(generalSettingsApiUrl("UploadFavicon"), fd)
        .then(function (res) {
          var data = res.data || {};
          if (!data.ok) {
            notificationsService.error("Upload favicon", "Invalid response from server.");
            return;
          }
          $scope.settings.faviconVersion = data.faviconVersion || "";
          notificationsService.success("Upload", "Favicon uploaded.");
          load();
        })
        .catch(function (res) {
          var msg =
            (res.data && (res.data.error || res.data.message)) ||
            (res.status ? "HTTP " + res.status : "Upload failed.");
          notificationsService.error("Upload favicon", msg);
        })
        .finally(function () {
          $scope.uploadingFavicon = false;
        });
    };

    var fontOptions = [
      {
        label: "System UI (mac / Windows)",
        value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      },
      { label: "Inter (sans-serif)", value: '"Inter", system-ui, sans-serif' },
      { label: "Roboto", value: 'Roboto, "Helvetica Neue", Arial, sans-serif' },
      { label: "Open Sans", value: '"Open Sans", system-ui, sans-serif' },
      { label: "Lato", value: "Lato, system-ui, sans-serif" },
      { label: "Georgia (serif)", value: "Georgia, 'Times New Roman', serif" },
      { label: "Merriweather (serif)", value: "Merriweather, Georgia, serif" },
      { label: "SourceHanSansCN-Normal", value: "SourceHanSansCN-Normal, system-ui, sans-serif" },
      { label: "Microsoft YaHei", value: "Microsoft YaHei, system-ui, sans-serif" },
      {
        label: "Monospace (code)",
        value: 'ui-monospace, "Cascadia Code", "Segoe UI Mono", monospace',
      },
    ];

    $scope.fontChoices = fontOptions.concat([
      { label: "Custom font…", value: "__custom__" },
    ]);

    function normalizeHex(hex) {
      if (!hex || typeof hex !== "string") return "#000000";
      var h = hex.trim();
      if (/^#[0-9A-Fa-f]{6}$/.test(h)) return h;
      if (/^#[0-9A-Fa-f]{3}$/.test(h)) {
        return (
          "#" +
          h[1] +
          h[1] +
          h[2] +
          h[2] +
          h[3] +
          h[3]
        ).toLowerCase();
      }
      return "#000000";
    }

    function normalizePalette() {
      $scope.settings.primaryColor = normalizeHex($scope.settings.primaryColor);
      $scope.settings.secondaryColor = normalizeHex($scope.settings.secondaryColor);
      $scope.settings.accentColor = normalizeHex($scope.settings.accentColor);
    }

    function syncFontFromSettings() {
      var family = ($scope.settings.fontFamily || "").trim();
      var hit = fontOptions.filter(function (o) {
        return o.value === family;
      })[0];
      if (hit) {
        $scope.fontSelection = hit.value;
        $scope.customFont = "";
      } else {
        $scope.fontSelection = "__custom__";
        $scope.customFont = family;
      }
    }

    $scope.$watch("fontSelection", function (v) {
      if (!v) return;
      if (v !== "__custom__") {
        $scope.settings.fontFamily = v;
        return;
      }
      $scope.customFont = $scope.settings.fontFamily || "";
    });

    $scope.$watch("customFont", function (v) {
      if ($scope.fontSelection === "__custom__" && v != null) {
        $scope.settings.fontFamily = v;
      }
    });

    function mapServerPayloadToSettings(raw) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
      function pick(camel, pascal) {
        var a = raw[camel];
        var b = raw[pascal];
        if (a !== undefined && a !== null && a !== "") return a;
        if (b !== undefined && b !== null && b !== "") return b;
        return undefined;
      }
      var out = {};
      var tag = pick("tagline", "Tagline");
      if (tag !== undefined) out.tagline = tag;
      var fv = pick("faviconVersion", "FaviconVersion");
      if (fv !== undefined) out.faviconVersion = fv;
      var f = pick("fontFamily", "FontFamily");
      if (f !== undefined) out.fontFamily = f;
      var p = pick("primaryColor", "PrimaryColor");
      if (p !== undefined) out.primaryColor = p;
      var s = pick("secondaryColor", "SecondaryColor");
      if (s !== undefined) out.secondaryColor = s;
      var ac = pick("accentColor", "AccentColor");
      if (ac !== undefined) out.accentColor = ac;
      var css = raw.customCss;
      if (css === undefined || css === null) css = raw.CustomCss;
      if (css !== undefined) out.customCss = css;
      var ucss = raw.userCss;
      if (ucss === undefined || ucss === null) ucss = raw.UserCss;
      // Back-compat: trước khi tách userCss, người dùng có thể đã nhập vào customCss.
      // Nhưng hiện tại `customCss` còn được dùng để chứa @font-face generate (marker __site_font_upload_*__),
      // nên chỉ migrate nếu KHÔNG thấy marker.
      if (
        (ucss === undefined || ucss === null || ucss === "") &&
        css &&
        String(css).indexOf("/* __site_font_upload_start__ */") === -1
      ) {
        ucss = css;
      }
      if (ucss !== undefined) out.userCss = ucss;
      var ujs = raw.userJs;
      if (ujs === undefined || ujs === null) ujs = raw.UserJs;
      if (ujs !== undefined) out.userJs = ujs;
      var cwc = pick("contentWrapperClass", "ContentWrapperClass");
      if (cwc !== undefined) out.contentWrapperClass = cwc;
      var bp = raw.boxPadding;
      if (bp === undefined || bp === null) bp = raw.BoxPadding;
      if (bp && typeof bp === "object" && !Array.isArray(bp)) {
        out.boxPadding = angular.extend({}, defaults.boxPadding, bp);
      }
      var cScss = raw.containerScss;
      if (cScss === undefined || cScss === null) cScss = raw.ContainerScss;
      if (cScss !== undefined && cScss !== null) out.containerScss = cScss;
      var rem = raw.useRem10px;
      if (rem === undefined || rem === null) rem = raw.UseRem10px;
      if (rem !== undefined && rem !== null) out.useRem10px = !!rem;
      return out;
    }

    function load() {
      $http
        .get(generalSettingsApiUrl("Get"))
        .then(function (res) {
          var data =
            res.data && typeof res.data === "object" && !Array.isArray(res.data)
              ? res.data
              : {};
          $scope.settings = angular.extend(
            {},
            defaults,
            mapServerPayloadToSettings(data)
          );
          if (
            $scope.settings.contentWrapperClass === "container" &&
            !String($scope.settings.containerScss || "").trim()
          ) {
            $scope.settings.containerScss = defaultContainerScss;
          }
          normalizePalette();
          syncFontFromSettings();
          $scope.applyLiveCustomCss();
          $scope.applyLiveUserCss();
          $scope.applyLiveUserJs();
        })
        .catch(function () {
          $scope.settings = angular.extend({}, defaults);
          normalizePalette();
          syncFontFromSettings();
          $scope.applyLiveCustomCss();
          $scope.applyLiveUserCss();
          $scope.applyLiveUserJs();
          notificationsService.error("Error", "Could not read configuration file.");
        })
        .finally(function () {
          $scope.loading = false;
        });
    }

    $scope.save = function () {
      if ($scope.fontSelection === "__custom__") {
        $scope.settings.fontFamily = ($scope.customFont || "").trim();
      } else if ($scope.fontSelection && $scope.fontSelection !== "__custom__") {
        $scope.settings.fontFamily = $scope.fontSelection;
      }
      normalizePalette();
      var payload = {
        tagline: $scope.settings.tagline != null ? String($scope.settings.tagline) : "",
        fontFamily: $scope.settings.fontFamily,
        primaryColor: $scope.settings.primaryColor,
        secondaryColor: $scope.settings.secondaryColor,
        accentColor: $scope.settings.accentColor,
        customCss:
          $scope.settings.customCss != null ? $scope.settings.customCss : "",
        userCss: $scope.settings.userCss != null ? $scope.settings.userCss : "",
        userJs: $scope.settings.userJs != null ? $scope.settings.userJs : "",
        useRem10px: !!$scope.settings.useRem10px,
        contentWrapperClass: ($scope.settings.contentWrapperClass || "").trim(),
        boxPadding: $scope.settings.boxPadding || null,
        containerScss:
          $scope.settings.containerScss != null ? $scope.settings.containerScss : "",
      };
      return $http
        .post(generalSettingsApiUrl("Save"), payload)
        .then(function (res) {
          var d = (res && res.data) || {};
          if (d.userJsError) {
            notificationsService.warning("Custom JS file", String(d.userJsError));
          }
          var msg = "Successfully written to Config/general-settings.json.";
          notificationsService.success("Saved", msg);
          load();
        })
        .catch(function () {
          notificationsService.error("Error", "Could not save (please check file write permissions).");
        });
    };

    $scope.wrapperChoices = [
      { label: ".box-padding", value: "box-padding" },
      { label: ".container", value: "container" },
    ];
    $scope.wrapperDropdownOpen = false;
    $scope.toggleWrapperDropdown = function () {
      $scope.wrapperDropdownOpen = !$scope.wrapperDropdownOpen;
    };
    $scope.selectWrapperChoice = function (choice) {
      if (!choice) return;
      $scope.settings.contentWrapperClass = choice.value;
      if (
        choice.value === "container" &&
        !String($scope.settings.containerScss || "").trim()
      ) {
        $scope.settings.containerScss = defaultContainerScss;
      }
      $scope.wrapperDropdownOpen = false;
    };
    $scope.getWrapperChoiceLabel = function () {
      var v = String($scope.settings.contentWrapperClass || "").trim();
      var hit = ($scope.wrapperChoices || []).filter(function (o) {
        return o.value === v;
      })[0];
      return hit ? hit.label : v || ".box-padding";
    };

    function toInt(v, fallback) {
      var n = parseInt(v, 10);
      return isFinite(n) ? n : fallback;
    }

    function normalizeBoxPadding(bp) {
      bp = bp || {};
      var minPad = toInt(bp.minPaddingInlinePx, 15);
      var maxPad = toInt(bp.maxPaddingInlinePx, 300);
      if (maxPad < minPad) {
        var t = minPad;
        minPad = maxPad;
        maxPad = t;
      }
      var minVw = toInt(bp.minFluidViewportPx, 870);
      var maxVw = toInt(bp.maxFluidViewportPx, 1820);
      if (maxVw < minVw) {
        var t2 = minVw;
        minVw = maxVw;
        maxVw = t2;
      }
      if (maxVw === minVw) maxVw = minVw + 1;
      return {
        minPaddingInlinePx: minPad,
        maxPaddingInlinePx: maxPad,
        minFluidViewportPx: minVw,
        maxFluidViewportPx: maxVw,
      };
    }

    $scope.getGeneratedBoxPaddingCss = function () {
      var bp = normalizeBoxPadding($scope.settings.boxPadding);
      var deltaPad = bp.maxPaddingInlinePx - bp.minPaddingInlinePx;
      var deltaVw = bp.maxFluidViewportPx - bp.minFluidViewportPx;
      return [
        ".box-padding {",
        "  padding-inline: " + bp.minPaddingInlinePx + "px;",
        "",
        "  @media (min-width: " + bp.minFluidViewportPx + "px) and (max-width: " + bp.maxFluidViewportPx + "px) {",
        "    padding-inline: calc(" +
          bp.minPaddingInlinePx +
          "px + (" +
          deltaPad +
          " * (100vw - " +
          bp.minFluidViewportPx +
          "px) / " +
          deltaVw +
          "));",
        "  }",
        "",
        "  @media (min-width: " + bp.maxFluidViewportPx + "px) {",
        "    padding-inline: " + bp.maxPaddingInlinePx + "px;",
        "  }",
        "}",
      ].join("\n");
    };

    function normalizeFontFamilyForCssValue(v) {
      if (v == null) return "";
      return String(v).trim();
    }

    $scope.getGeneratedSiteAppearanceCss = function () {
      var fontFamily = normalizeFontFamilyForCssValue($scope.settings.fontFamily);
      var primary = normalizeHex($scope.settings.primaryColor);
      var secondary = normalizeHex($scope.settings.secondaryColor);
      var accent = normalizeHex($scope.settings.accentColor);

      // Chỉ hiển thị @font-face được generate khi user đang chọn Custom font.
      // Khi chọn preset stack, preview vẫn hiển thị theme vars nhưng bỏ phần @font-face.
      var rawCustomCss = $scope.settings.customCss != null ? String($scope.settings.customCss) : "";
      var cssForPreview = $scope.isCustomFontSelection()
        ? rawCustomCss
        : stripGeneratedFontFace(rawCustomCss);

      var lines = [];
      lines.push(":root {");
      if (fontFamily) lines.push("  --site-font-family: " + fontFamily + ";");
      lines.push("  --site-color-primary: " + primary + ";");
      lines.push("  --site-color-secondary: " + secondary + ";");
      lines.push("  --site-color-accent: " + accent + ";");
      lines.push("}");

      if (cssForPreview && cssForPreview.trim()) {
        lines.push("");
        lines.push(cssForPreview.trim());
      }

      return lines.join("\n");
    };

    var LIVE_CUSTOM_CSS_STYLE_ID = "tg-live-custom-css";
    var liveCssDebounce = null;

    function setLiveCustomCss(cssText) {
      var head = document && document.head;
      if (!head) return;
      var el = document.getElementById(LIVE_CUSTOM_CSS_STYLE_ID);
      if (!el) {
        el = document.createElement("style");
        el.type = "text/css";
        el.id = LIVE_CUSTOM_CSS_STYLE_ID;
        head.appendChild(el);
      }
      el.textContent = cssText || "";
    }

    $scope.applyLiveCustomCss = function () {
      if (liveCssDebounce) {
        $timeout.cancel(liveCssDebounce);
        liveCssDebounce = null;
      }
      liveCssDebounce = $timeout(function () {
        var css = $scope.getGeneratedSiteAppearanceCss();
        setLiveCustomCss(css);
      }, 120);
    };

    $scope.$watchGroup(
      [
        "settings.fontFamily",
        "settings.primaryColor",
        "settings.secondaryColor",
        "settings.accentColor",
        "settings.customCss",
        "fontSelection",
      ],
      function () {
        $scope.applyLiveCustomCss();
      }
    );

    var LIVE_USER_CSS_STYLE_ID = "tg-live-user-css";
    var liveUserCssDebounce = null;

    function setLiveUserCss(cssText) {
      var head = document && document.head;
      if (!head) return;
      var el = document.getElementById(LIVE_USER_CSS_STYLE_ID);
      if (!el) {
        el = document.createElement("style");
        el.type = "text/css";
        el.id = LIVE_USER_CSS_STYLE_ID;
        head.appendChild(el);
      }
      el.textContent = cssText || "";
    }

    $scope.applyLiveUserCss = function () {
      if (liveUserCssDebounce) {
        $timeout.cancel(liveUserCssDebounce);
        liveUserCssDebounce = null;
      }
      liveUserCssDebounce = $timeout(function () {
        var css = $scope.settings.userCss != null ? String($scope.settings.userCss) : "";
        setLiveUserCss(css);
      }, 120);
    };

    $scope.$watch("settings.userCss", function () {
      $scope.applyLiveUserCss();
    });

    var LIVE_USER_JS_SCRIPT_ID = "tg-live-user-js-preview";
    var LIVE_JQUERY_LOADER_ID = "tg-live-jquery-loader";
    var liveUserJsDebounce = null;

    function removeLiveUserJsPreview() {
      var old = document.getElementById(LIVE_USER_JS_SCRIPT_ID);
      if (old) old.remove();
    }

    function runUserJsPreview(code) {
      removeLiveUserJsPreview();
      if (!code || !String(code).trim()) return;
      var s = document.createElement("script");
      s.id = LIVE_USER_JS_SCRIPT_ID;
      s.type = "text/javascript";
      s.text = code;
      var parent = document.body || document.documentElement;
      parent.appendChild(s);
    }

    $scope.applyLiveUserJs = function () {
      if (liveUserJsDebounce) {
        $timeout.cancel(liveUserJsDebounce);
        liveUserJsDebounce = null;
      }
      liveUserJsDebounce = $timeout(function () {
        var code = $scope.settings.userJs != null ? String($scope.settings.userJs) : "";
        if (!String(code).trim()) {
          removeLiveUserJsPreview();
          return;
        }
        function run() {
          runUserJsPreview(code);
        }
        if (window.jQuery) {
          run();
          return;
        }
        var existing = document.getElementById(LIVE_JQUERY_LOADER_ID);
        if (existing) {
          if (existing.getAttribute("data-loaded") === "1") {
            run();
          } else {
            existing.addEventListener("load", run, { once: true });
          }
          return;
        }
        var loader = document.createElement("script");
        loader.id = LIVE_JQUERY_LOADER_ID;
        loader.src = "/scripts/lib/jquery.min.js";
        loader.onload = function () {
          loader.setAttribute("data-loaded", "1");
          run();
        };
        document.head.appendChild(loader);
      }, 200);
    };

    $scope.$watch("settings.userJs", function () {
      $scope.applyLiveUserJs();
    });

    $scope.$on("$destroy", function () {
      removeLiveUserJsPreview();
      var jl = document.getElementById(LIVE_JQUERY_LOADER_ID);
      if (jl) jl.remove();
    });

    function normalizeEditorText(value) {
      var text = value == null ? "" : String(value);
      text = text.replace(/\r\n/g, "\n");
      // Trim trailing whitespace per line, keep final newline as-is (user preference).
      text = text
        .split("\n")
        .map(function (line) {
          return line.replace(/[ \t]+$/g, "");
        })
        .join("\n");
      return text;
    }

    function getEditorValue(modelKey) {
      if (modelKey === "userCss") return $scope.settings.userCss;
      if (modelKey === "userJs") return $scope.settings.userJs;
      return "";
    }

    function setEditorValue(modelKey, newValue) {
      if (modelKey === "userCss") {
        $scope.settings.userCss = newValue;
        $scope.applyLiveUserCss();
        return;
      }
      if (modelKey === "userJs") {
        $scope.settings.userJs = newValue;
        $scope.applyLiveUserJs();
        return;
      }
    }

    $scope.copyEditorValue = function (modelKey) {
      var text = normalizeEditorText(getEditorValue(modelKey));
      function ok() {
        notificationsService.success("Copied", "Copied to clipboard.");
      }
      function fail() {
        notificationsService.warning("Copy", "Could not copy to clipboard.");
      }
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok, fail);
        return;
      }
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        var success = document.execCommand("copy");
        document.body.removeChild(ta);
        success ? ok() : fail();
      } catch (e) {
        fail();
      }
    };

    $scope.formatEditorValue = function (modelKey) {
      var ed = $scope._tgEditors && $scope._tgEditors[String(modelKey || "")];
      if (ed && ed.getAction) {
        var a = ed.getAction("editor.action.formatDocument");
        if (a && a.run) {
          var before = getEditorValue(modelKey);
          a.run().then(
            function () {
              // If Monaco has no formatter, it often results in no changes.
              // In that case, apply our fallback beautifier to make Format useful.
              $timeout(function () {
                var after = getEditorValue(modelKey);
                if (String(after || "") === String(before || "")) {
                  var formatted = formatByKey(modelKey, after);
                  setEditorValue(modelKey, formatted);
                  notificationsService.success("Formatted", "Formatted with fallback formatter.");
                } else {
                  notificationsService.success("Formatted", "Formatted document.");
                }
              }, 0);
            },
            function () {
              var formatted0 = formatByKey(modelKey, getEditorValue(modelKey));
              setEditorValue(modelKey, formatted0);
              notificationsService.success("Formatted", "Formatted with fallback formatter.");
            }
          );
          return;
        }
      }
      var formatted = formatByKey(modelKey, getEditorValue(modelKey));
      setEditorValue(modelKey, formatted);
      notificationsService.success("Formatted", "Formatted with fallback formatter.");
    };

    $scope.handleEditorKeydown = function ($event, modelKey) {
      if (!$event) return;
      // Tab indentation
      if ($event.key === "Tab" || $event.keyCode === 9) {
        $event.preventDefault();
        var el = $event.target;
        if (!el || typeof el.selectionStart !== "number" || typeof el.selectionEnd !== "number") return;

        var indent = "  ";
        var val = getEditorValue(modelKey);
        val = val == null ? "" : String(val);
        var start = el.selectionStart;
        var end = el.selectionEnd;

        // If multi-line selection: indent each line in selection.
        var before = val.slice(0, start);
        var selected = val.slice(start, end);
        var after = val.slice(end);

        if (selected.indexOf("\n") !== -1) {
          var selLines = selected.split("\n");
          for (var i = 0; i < selLines.length; i++) selLines[i] = indent + selLines[i];
          var next = before + selLines.join("\n") + after;
          setEditorValue(modelKey, next);
          $timeout(function () {
            try {
              el.selectionStart = start;
              el.selectionEnd = end + indent.length * selLines.length;
            } catch (ignore) {}
          }, 0);
          return;
        }

        var next2 = before + indent + selected + after;
        setEditorValue(modelKey, next2);
        $timeout(function () {
          try {
            var pos = start + indent.length;
            el.selectionStart = pos;
            el.selectionEnd = pos;
          } catch (ignore) {}
        }, 0);
      }
    };

    function formatByKey(modelKey, text) {
      var t = text == null ? "" : String(text);
      if (String(modelKey || "") === "userJs") return prettyFormatJs(t);
      if (String(modelKey || "") === "userCss") return prettyFormatCss(t);
      return normalizeEditorText(t);
    }

    function prettyFormatCss(input) {
      // Simple CSS formatter: braces + semicolons + indentation.
      // Not a full parser, but good enough for typical user snippets.
      var s = normalizeEditorText(input).trim();
      if (!s) return "";
      var out = [];
      var indent = 0;
      var i = 0;
      var inStr = false;
      var strCh = "";
      function pushLine(line) {
        out.push(new Array(indent + 1).join("  ") + line.trim());
      }
      var buf = "";
      while (i < s.length) {
        var ch = s[i];
        var next = s[i + 1];
        if (!inStr && ch === "/" && next === "*") {
          // block comment
          var end = s.indexOf("*/", i + 2);
          var c = end === -1 ? s.slice(i) : s.slice(i, end + 2);
          if (buf.trim()) {
            pushLine(buf);
            buf = "";
          }
          pushLine(c);
          i = end === -1 ? s.length : end + 2;
          continue;
        }
        if (!inStr && (ch === '"' || ch === "'")) {
          inStr = true;
          strCh = ch;
          buf += ch;
          i++;
          continue;
        }
        if (inStr) {
          buf += ch;
          if (ch === "\\" && i + 1 < s.length) {
            buf += s[i + 1];
            i += 2;
            continue;
          }
          if (ch === strCh) {
            inStr = false;
            strCh = "";
          }
          i++;
          continue;
        }
        if (ch === "{") {
          var head = buf.trim();
          buf = "";
          pushLine(head + " {");
          indent++;
          i++;
          continue;
        }
        if (ch === "}") {
          if (buf.trim()) {
            pushLine(buf);
            buf = "";
          }
          indent = Math.max(0, indent - 1);
          pushLine("}");
          i++;
          continue;
        }
        if (ch === ";") {
          buf += ";";
          pushLine(buf);
          buf = "";
          i++;
          continue;
        }
        if (ch === "\n") {
          if (buf.trim()) {
            pushLine(buf);
            buf = "";
          }
          i++;
          continue;
        }
        buf += ch;
        i++;
      }
      if (buf.trim()) pushLine(buf);
      return out.join("\n") + "\n";
    }

    function prettyFormatJs(input) {
      // Simple JS formatter: braces + semicolons + indentation.
      // Handles strings and basic comments; not a full JS parser.
      var s = normalizeEditorText(input).trim();
      if (!s) return "";
      var out = [];
      var indent = 0;
      var i = 0;
      var inStr = false;
      var strCh = "";
      var inLineComment = false;
      var inBlockComment = false;
      var buf = "";
      function pushLine(line) {
        var t = line.replace(/\s+/g, " ").trim();
        if (!t) return;
        out.push(new Array(indent + 1).join("  ") + t);
      }
      while (i < s.length) {
        var ch = s[i];
        var next = s[i + 1];

        if (inLineComment) {
          buf += ch;
          if (ch === "\n") {
            pushLine(buf);
            buf = "";
            inLineComment = false;
          }
          i++;
          continue;
        }
        if (inBlockComment) {
          buf += ch;
          if (ch === "*" && next === "/") {
            buf += "/";
            i += 2;
            pushLine(buf);
            buf = "";
            inBlockComment = false;
            continue;
          }
          i++;
          continue;
        }

        if (!inStr && ch === "/" && next === "/") {
          if (buf.trim()) {
            pushLine(buf);
            buf = "";
          }
          inLineComment = true;
          buf = "//";
          i += 2;
          continue;
        }
        if (!inStr && ch === "/" && next === "*") {
          if (buf.trim()) {
            pushLine(buf);
            buf = "";
          }
          inBlockComment = true;
          buf = "/*";
          i += 2;
          continue;
        }

        if (!inStr && (ch === '"' || ch === "'" || ch === "`")) {
          inStr = true;
          strCh = ch;
          buf += ch;
          i++;
          continue;
        }
        if (inStr) {
          buf += ch;
          if (ch === "\\" && i + 1 < s.length) {
            buf += s[i + 1];
            i += 2;
            continue;
          }
          if (ch === strCh) {
            inStr = false;
            strCh = "";
          }
          i++;
          continue;
        }

        if (ch === "{") {
          var head = buf.trim();
          buf = "";
          pushLine(head + " {");
          indent++;
          i++;
          continue;
        }
        if (ch === "}") {
          if (buf.trim()) {
            pushLine(buf);
            buf = "";
          }
          indent = Math.max(0, indent - 1);
          pushLine("}");
          i++;
          continue;
        }
        if (ch === ";") {
          buf += ";";
          pushLine(buf);
          buf = "";
          i++;
          continue;
        }
        if (ch === "\n") {
          if (buf.trim()) {
            pushLine(buf);
            buf = "";
          }
          i++;
          continue;
        }
        buf += ch;
        i++;
      }
      if (buf.trim()) pushLine(buf);
      return out.join("\n") + "\n";
    }

    /** Cho host absolute inset:0 — cha trực tiếp (wrapper ng-include) cần cao 100% khớp .umb-editor */
    var scrollHostLayoutCleanup = null;
    function wireScrollHostLayout() {
      if (scrollHostLayoutCleanup) return;
      var host = document.querySelector(".tg-setting-general-host");
      if (!host || !host.parentElement) return;
      var p = host.parentElement;
      var saved = { height: p.style.height, minHeight: p.style.minHeight, position: p.style.position };
      p.style.height = "100%";
      p.style.minHeight = "0";
      if ((window.getComputedStyle(p).position || "") === "static") {
        p.style.position = "relative";
      }
      scrollHostLayoutCleanup = function () {
        p.style.height = saved.height;
        p.style.minHeight = saved.minHeight;
        p.style.position = saved.position;
      };
      $scope.$on("$destroy", function () {
        if (scrollHostLayoutCleanup) {
          scrollHostLayoutCleanup();
          scrollHostLayoutCleanup = null;
        }
      });
    }

    $timeout(wireScrollHostLayout, 0);
    $timeout(wireScrollHostLayout, 200);

    load();
  },
]);

angular.module("umbraco").directive("tgMonacoEditor", [
  "$timeout",
  function ($timeout) {
    function getUmbracoPath() {
      try {
        var sv = Umbraco.Sys.ServerVariables;
        var base =
          (sv.umbracoSettings && sv.umbracoSettings.umbracoPath) || "/umbraco";
        if (typeof base !== "string") base = "/umbraco";
        return base.replace(/\/+$/, "");
      } catch (e) {
        return "/umbraco";
      }
    }

    function loadMonaco(cb) {
      if (window.monaco && window.monaco.editor) return cb(null, window.monaco);
      if (!window.require || !window.require.config) {
        return cb(new Error("RequireJS not available"));
      }
      var base = getUmbracoPath();
      window.require.config({
        paths: { vs: base + "/lib/monaco-editor/min/vs" },
      });
      window.require(
        ["vs/editor/editor.main"],
        function () {
          if (window.monaco && window.monaco.editor) return cb(null, window.monaco);
          cb(new Error("Monaco loaded but not available"));
        },
        function (err) {
          cb(err || new Error("Failed to load Monaco"));
        }
      );
    }

    return {
      restrict: "A",
      require: "ngModel",
      scope: {
        editorKey: "@",
        language: "@",
        placeholder: "@",
      },
      link: function (scope, element, attrs, ngModel) {
        var editor = null;
        var model = null;
        var suppress = false;

        function setReadyFlag(v) {
          try {
            var s = scope.$parent;
            if (!s) return;
            if (!s.monacoReady) s.monacoReady = {};
            s.monacoReady[String(scope.editorKey || "")] = !!v;
          } catch (ignore) {}
        }

        function registerEditorOnParent(ed) {
          try {
            var s = scope.$parent;
            if (!s) return;
            if (!s._tgEditors) s._tgEditors = {};
            s._tgEditors[String(scope.editorKey || "")] = ed;
          } catch (ignore) {}
        }

        function dispose() {
          try {
            if (editor) editor.dispose();
          } catch (ignore) {}
          editor = null;
          model = null;
        }

        setReadyFlag(false);

        loadMonaco(function (err, monaco) {
          if (err) {
            setReadyFlag(false);
            return;
          }

          $timeout(function () {
            var initial = ngModel.$viewValue == null ? "" : String(ngModel.$viewValue);
            var lang = String(scope.language || "plaintext");

            model = monaco.editor.createModel(initial, lang);

            editor = monaco.editor.create(element[0], {
              model: model,
              automaticLayout: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
              lineHeight: 20,
              lineNumbers: "on",
              lineNumbersMinChars: 3,
              roundedSelection: true,
              wordWrap: "on",
              tabSize: 2,
              insertSpaces: true,
              renderWhitespace: "selection",
              renderLineHighlight: "line",
              glyphMargin: false,
              folding: true,
              contextmenu: true,
              padding: { top: 10, bottom: 10 },
              theme: "vs-dark",
            });

            registerEditorOnParent(editor);
            setReadyFlag(true);

            // Ensure content starts at top (avoid weird vertical offset).
            try {
              editor.setScrollTop(0);
              editor.revealLine(1);
            } catch (ignore) {}

            // Placeholder (simple): show when empty by using an overlay widget.
            if (scope.placeholder) {
              var domNode = document.createElement("div");
              domNode.className = "tg-monaco-placeholder";
              domNode.textContent = scope.placeholder;
              var widget = {
                getId: function () {
                  return "tg-monaco-placeholder-" + (scope.editorKey || "");
                },
                getDomNode: function () {
                  return domNode;
                },
                getPosition: function () {
                  return { position: { lineNumber: 1, column: 1 }, preference: [0] };
                },
              };
              editor.addOverlayWidget(widget);
              function updatePlaceholder() {
                try {
                  var empty = !model.getValue();
                  domNode.style.display = empty ? "block" : "none";
                } catch (ignore) {}
              }
              updatePlaceholder();
              model.onDidChangeContent(updatePlaceholder);
            }

            model.onDidChangeContent(function () {
              if (suppress) return;
              suppress = true;
              $timeout(function () {
                try {
                  ngModel.$setViewValue(model.getValue());
                } finally {
                  suppress = false;
                }
              }, 0);
            });

            ngModel.$render = function () {
              if (!model) return;
              var v = ngModel.$viewValue == null ? "" : String(ngModel.$viewValue);
              if (model.getValue() === v) return;
              suppress = true;
              try {
                model.setValue(v);
              } finally {
                suppress = false;
              }
            };

            scope.$on("$destroy", function () {
              dispose();
            });
          }, 0);
        });
      },
    };
  },
]);
