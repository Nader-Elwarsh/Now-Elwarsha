/* حماية بالرقم السري: قفل دخول النظام + تأكيد إضافي قبل عمليات الحذف الجماعي/إعادة التهيئة.
   الرقم السري نفسه لا يُخزَّن؛ يُخزَّن فقط ناتج دالة تجزئة (hash) مع ملح (salt) عشوائي محليًا. */
(function () {
  "use strict";

  function hashOnce(str) {
    var h1 = 0x811c9dc5, h2 = 0x1000193;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      h1 = (h1 ^ c) >>> 0; h1 = Math.imul(h1, 16777619) >>> 0;
      h2 = (h2 + c) >>> 0; h2 = Math.imul(h2, 2246822519) >>> 0;
    }
    return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
  }
  function wfHash(pin, salt) {
    var h = salt + ":" + pin;
    for (var i = 0; i < 500; i++) h = hashOnce(h + i);
    return h;
  }
  function randSalt() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  var LK_HASH = "wf_pin_hash", LK_SALT = "wf_pin_salt", SK_UNLOCK = "wf_unlocked";
  var LK_ENTRY = "wf_pin_lock_entry", LK_DELETE = "wf_pin_lock_delete";

  var WFLock = {
    isSet: function () { return !!localStorage.getItem(LK_HASH); },
    setPin: function (pin) {
      var salt = randSalt();
      localStorage.setItem(LK_SALT, salt);
      localStorage.setItem(LK_HASH, wfHash(pin, salt));
      if (localStorage.getItem(LK_ENTRY) === null) localStorage.setItem(LK_ENTRY, "1");
      if (localStorage.getItem(LK_DELETE) === null) localStorage.setItem(LK_DELETE, "1");
    },
    verify: function (pin) {
      var salt = localStorage.getItem(LK_SALT) || "";
      return wfHash(pin, salt) === localStorage.getItem(LK_HASH);
    },
    removePin: function () {
      localStorage.removeItem(LK_HASH);
      localStorage.removeItem(LK_SALT);
      localStorage.removeItem(LK_ENTRY);
      localStorage.removeItem(LK_DELETE);
      sessionStorage.removeItem(SK_UNLOCK);
    },
    isUnlocked: function () { return sessionStorage.getItem(SK_UNLOCK) === "1"; },
    unlock: function () { sessionStorage.setItem(SK_UNLOCK, "1"); },
    entryLockEnabled: function () { return localStorage.getItem(LK_ENTRY) !== "0"; },
    setEntryLockEnabled: function (v) { localStorage.setItem(LK_ENTRY, v ? "1" : "0"); },
    deleteLockEnabled: function () { return localStorage.getItem(LK_DELETE) !== "0"; },
    setDeleteLockEnabled: function (v) { localStorage.setItem(LK_DELETE, v ? "1" : "0"); },
    /* تأكيد إضافي قبل عملية حساسة، يرجع true/false */
    requirePin: function (msg) {
      if (!this.isSet()) return true;
      var pin = prompt(msg || "🔒 اكتب الرقم السري للتأكيد:");
      if (pin === null) return false;
      if (!this.verify(pin)) { alert("رقم سري غير صحيح."); return false; }
      return true;
    },
    /* زي requirePin بالظبط، لكن بيحترم مفتاح تفعيل قفل الحذف لوحده */
    requireDeletePin: function (msg) {
      if (!this.isSet() || !this.deleteLockEnabled()) return true;
      return this.requirePin(msg);
    },
    /* يشتغل عند تحميل أي صفحة؛ يمنع أي كود تاني من الاستمرار لحد ما الرقم يتظبط */
    ensureEntryUnlocked: function () {
      if (!this.isSet() || !this.entryLockEnabled() || this.isUnlocked()) return;
      while (true) {
        var pin = prompt("🔒 اكتب الرقم السري للدخول للنظام:");
        if (pin !== null && this.verify(pin)) { this.unlock(); return; }
        if (pin !== null) alert("رقم سري غير صحيح، حاول تاني.");
      }
    }
  };

  window.WFLock = WFLock;
  WFLock.ensureEntryUnlocked();

  /* تأمين عمليات الحذف الجماعي وإعادة التهيئة بالرقم السري، لو كان مفعّل */
  document.addEventListener("DOMContentLoaded", function () {
    var guarded = {
      deleteAllCustomers: "حذف جميع العملاء وما يرتبط بهم",
      deleteAllDevices: "حذف جميع الأجهزة وأوامرها",
      deleteAllRequests: "حذف جميع أوامر الشغل",
      deleteAllOperationalData: "حذف كل البيانات التشغيلية (إعادة تهيئة النظام)"
    };
    Object.keys(guarded).forEach(function (name) {
      var orig = window[name];
      if (typeof orig !== "function") return;
      window[name] = function () {
        if (!WFLock.requireDeletePin("🔒 اكتب الرقم السري لتأكيد: " + guarded[name])) return;
        return orig.apply(this, arguments);
      };
    });
  });
})();
