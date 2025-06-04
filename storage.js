;(function(window) {
 
  function recordCategory(category) {
    if (!category || typeof category !== "string") return;

    const statKey = "stat" + category;
    const tsKey   = "timestamps" + category;

    const rawCount = parseInt(localStorage.getItem(statKey), 10);
    const newCount = (isNaN(rawCount) ? 0 : rawCount) + 1;
    localStorage.setItem(statKey, newCount);

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

  window.Storage = {
    recordCategory,
    getCount,
    getTimestamps
  };
})(window);
