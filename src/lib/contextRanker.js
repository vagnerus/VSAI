/**
 * ContextRanker — Ranks knowledge files based on their relevance to the user's query.
 * A lightweight alternative to full vector search for small-to-medium datasets.
 */
export function rankContext(query, files, limit = 5) {
  if (!files || files.length === 0) return [];
  if (!query) return files.slice(0, limit);

  const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
  
  const ranked = files.map(file => {
    let score = 0;
    const contentLower = (file.file_name + ' ' + file.content).toLowerCase();
    
    keywords.forEach(kw => {
      if (contentLower.includes(kw)) {
        // Count occurrences
        const count = contentLower.split(kw).length - 1;
        score += count;
        // Bonus for keyword in filename
        if (file.file_name.toLowerCase().includes(kw)) score += 10;
      }
    });
    
    return { ...file, score };
  });

  return ranked
    .filter(f => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
