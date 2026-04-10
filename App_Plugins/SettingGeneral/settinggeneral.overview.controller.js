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
