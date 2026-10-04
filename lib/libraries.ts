export const LIBRARIES = [
 {id:"ecology",name:"生態環境庫",description:"鳥類、植物、濕地、水環境",layout:"觀察紀錄",fields:["觀察地點與 GPS","觀察時間","物種／植物名稱","環境狀態與干擾","辨識依據與待查證項目"]},
 {id:"hakka",name:"客家文化庫",description:"語言、歌謠、祭典、建築、產業",layout:"文化與語境",fields:["文化項目與地方名稱","語言／腔調與原文","文化持有社群","情境、意義與使用禁忌","傳承方式與來源"]},
 {id:"memory",name:"地方記憶庫",description:"眷村、老街、地名、人物、照片",layout:"記憶時間軸",fields:["地點與舊地名","年代與時間軸","口述者／提供者","逐字稿與人工校訂","老照片、地圖的來源與對照"]},
 {id:"craft",name:"產業技藝庫",description:"茶、農事、木作、米食、工藝",layout:"技藝步驟",fields:["技藝與地方品種","材料、工具與準備","操作步驟（逐步記錄）","時間、溫度、手感與師傅判斷","傳承脈絡與注意事項"]},
 {id:"news",name:"公民新聞庫",description:"事件、議題、採訪、影像、觀點",layout:"採訪與查核",fields:["事件時間、地點與議題","採訪對象與各方觀點","報導與逐字稿","證據來源與查核結果","待追蹤事項與更正紀錄"]},
 {id:"people",name:"人物故事庫",description:"老師、匠人、居民、地方組織",layout:"人物訪談",fields:["人物／組織名稱與稱呼","與地方的關係","生命歷程與重要節點","訪談原文與代表故事","貢獻、相關人物及授權範圍"]},
] as const;
export type LibraryId = typeof LIBRARIES[number]["id"];
export function libraryById(id?:string){return LIBRARIES.find(l=>l.id===id)??LIBRARIES[0];}
export function libraryContent(id:string,fields:Record<string,string>,body:string){return [body.trim(),...libraryById(id).fields.filter(k=>fields[k]?.trim()).map(k=>`【${k}】\n${fields[k].trim()}`)].filter(Boolean).join("\n\n");}

export function demoLibrary(id:string){return ({"demo-coast":"ecology","demo-town":"memory","demo-river":"ecology","demo-language":"hakka","demo-farm":"craft","demo-source":"memory"} as Record<string,string>)[id]??"";}
