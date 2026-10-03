export const topics = [
  {id:"coast", title:"海岸與生活技藝", region:"新屋", text:"從海岸觀察、漁業技藝到季節生活，保存方法、實踐者與使用條件。", keys:["海岸","捕魚","石滬"], questions:["誰持有這項技藝？", "哪些位置不宜公開？", "不同季節如何影響實作？"]},
  {id:"town", title:"街區與地方記憶", region:"楊梅", text:"把走讀路線、居民記憶與地方文獻放在一起閱讀，保留不同說法。", keys:["街區","走讀","記憶"], questions:["居民與文獻的說法有何差異？", "照片與訪談能否相互定位？", "哪些年代仍待查證？"]},
  {id:"river", title:"溪流與環境共學", region:"平鎮", text:"串起觀察方法、現場筆記與環境教育，讓長期變化有可比較的紀錄。", keys:["溪流","水環境","污染"], questions:["現場經驗與量測資料如何對照？", "是否保留方法與單位？", "一次觀察能支持哪些結論？"]},
  {id:"language", title:"語言與口述歷史", region:"跨區", text:"保存說話者的用字、腔調與生命經驗；不同記憶不必被合成單一版本。", keys:["長輩","客語","口述","語言"], questions:["逐字稿是否經說話者確認？", "翻譯遺失了哪些語境？", "公開同意是否包含聲音與影像？"]},
  {id:"farm", title:"食農與季節知識", region:"新屋", text:"從田間實作到飲食課程，留下作物、季節、技藝與知識來源。", keys:["食農","作物","農田"], questions:["在地經驗適用的環境是什麼？", "如何區分經驗與查得資料？", "教學成果如何回到地方使用？"]},
  {id:"source", title:"文獻與文化治理", region:"跨區", text:"用來源、版本與授權連結知識，讓社群能決定資料如何保存與再使用。", keys:["文獻","授權","來源"], questions:["每項說法能回查哪個來源？", "誰有權同意這種使用？", "用途改變時如何重新協商？"]},
] as const;
export function exportText(filename: string, text: string, type = "text/markdown;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], {type}));
  const link = document.createElement("a"); link.href = url; link.download = filename;
  link.hidden = true; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
