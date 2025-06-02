// storage.js
;(function(window) {
 
  function recordCategory(category) {
    if (!category || typeof category !== "string") return;

    // Build keys exactly as dashboard expects:
    const statKey = "stat" + category;
    const tsKey   = "timestamps" + category;

    // 1) Increment the counter (default 0)
    const rawCount = parseInt(localStorage.getItem(statKey), 10);
    const newCount = (isNaN(rawCount) ? 0 : rawCount) + 1;
    localStorage.setItem(statKey, newCount);

    // 2) Append a timestamp (ISO) to the array under timestamps<category>
    const rawArr = localStorage.getItem(tsKey) || "[]";
    let arr;
    try {
      arr = JSON.parse(rawArr);
      if (!Array.isArray(arr)) arr = [];
    } catch {
      arr = [];
    }
    arr.push(new Date().toISOString());
    localStorage.setItem(tsKey, JSON.stringify(arr));
  }

  /**
   * Returns the integer count stored in localStorage under "stat<category>",
   * or 0 if missing/invalid.
   *
   * Example:
   *   const herbalCount = Storage.getCount("Herbal");
   */
  function getCount(category) {
    if (!category || typeof category !== "string") return 0;
    const statKey = "stat" + category;
    const raw = parseInt(localStorage.getItem(statKey), 10);
    return isNaN(raw) ? 0 : raw;
  }


  function getTimestamps(category) {
    if (!category || typeof category !== "string") return [];
    const tsKey = "timestamps" + category;
    const raw = localStorage.getItem(tsKey) || "[]";
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  // Expose our API under window.Storage
  window.Storage = {
    recordCategory,
    getCount,
    getTimestamps
  };
})(window);
