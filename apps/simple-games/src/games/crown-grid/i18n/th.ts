import type { CrownGridMessages } from './en';

export const th: CrownGridMessages = {
  crownGridName: 'Crown Grid',
  crownGridChooseBoard: 'เลือกกระดาน',
  crownGridDifficulty_easy: 'ง่าย',
  crownGridDifficulty_medium: 'ปานกลาง',
  crownGridDifficulty_hard: 'ยาก',
  crownGridBoardNote: '{size}×{size}',
  crownGridConfirmSwitchTitle: 'แทนที่กระดานที่ค้างอยู่ไหม',
  crownGridConfirmSwitchBody: 'เกม {current} ที่ค้างอยู่จะถูกแทนที่ด้วยกระดาน {next} ใหม่',
  crownGridBoardLabel: 'กระดาน Crown Grid {size}×{size}',
  crownGridCellEmpty: 'ว่าง แถว {row} คอลัมน์ {col} พื้นที่ {region}',
  crownGridCellCross: 'กากบาท แถว {row} คอลัมน์ {col} พื้นที่ {region}',
  crownGridCellCrown: 'มงกุฎ แถว {row} คอลัมน์ {col} พื้นที่ {region}',
  crownGridRuleBroken: 'ผิดกติกา',
  crownGridHintViolation: 'มงกุฎที่เน้นไว้ผิดกติกา',
  crownGridHintWrong: 'มงกุฎที่ทำเครื่องหมายไว้ไม่ถูกต้อง',
  crownGridHintSingle_row: 'แถวที่เน้นไว้เหลือช่องเดียวสำหรับมงกุฎ นั่นคือช่องที่มีกรอบ',
  crownGridHintSingle_col: 'คอลัมน์ที่เน้นไว้เหลือช่องเดียวสำหรับมงกุฎ นั่นคือช่องที่มีกรอบ',
  crownGridHintSingle_region: 'พื้นที่ที่เน้นไว้เหลือช่องเดียวสำหรับมงกุฎ นั่นคือช่องที่มีกรอบ',
  crownGridHintConfine_regionRow:
    'พื้นที่ที่เน้นไว้จะวางมงกุฎได้แค่ในช่องที่แต้มสี ซึ่งอยู่ในแถวเดียวกันทั้งหมด — ช่องอื่นในแถวนั้น (มีกรอบ) จึงเป็นไปไม่ได้',
  crownGridHintConfine_regionCol:
    'พื้นที่ที่เน้นไว้จะวางมงกุฎได้แค่ในช่องที่แต้มสี ซึ่งอยู่ในคอลัมน์เดียวกันทั้งหมด — ช่องอื่นในคอลัมน์นั้น (มีกรอบ) จึงเป็นไปไม่ได้',
  crownGridHintConfine_rowRegion:
    'แถวที่เน้นไว้จะวางมงกุฎได้แค่ในช่องที่แต้มสี ซึ่งอยู่ในพื้นที่เดียวกันทั้งหมด — ช่องอื่นในพื้นที่นั้น (มีกรอบ) จึงเป็นไปไม่ได้',
  crownGridHintConfine_colRegion:
    'คอลัมน์ที่เน้นไว้จะวางมงกุฎได้แค่ในช่องที่แต้มสี ซึ่งอยู่ในพื้นที่เดียวกันทั้งหมด — ช่องอื่นในพื้นที่นั้น (มีกรอบ) จึงเป็นไปไม่ได้',
  crownGridHintAttack_row:
    'ถ้าวางมงกุฎในช่องที่มีกรอบ จะตัดช่องที่แต้มสีทั้งหมดออก ทำให้แถวที่เน้นไว้ไม่เหลือที่ว่างสำหรับมงกุฎเลย',
  crownGridHintAttack_col:
    'ถ้าวางมงกุฎในช่องที่มีกรอบ จะตัดช่องที่แต้มสีทั้งหมดออก ทำให้คอลัมน์ที่เน้นไว้ไม่เหลือที่ว่างสำหรับมงกุฎเลย',
  crownGridHintAttack_region:
    'ถ้าวางมงกุฎในช่องที่มีกรอบ จะตัดช่องที่แต้มสีทั้งหมดออก ทำให้พื้นที่ที่เน้นไว้ไม่เหลือที่ว่างสำหรับมงกุฎเลย',
  crownGridHintPair_regionsRows:
    'สองพื้นที่ที่เน้นไว้จะวางมงกุฎได้แค่ในช่องที่แต้มสี ซึ่งพอดีอยู่ในสองแถวเท่านั้น — ช่องอื่นในสองแถวนั้น (มีกรอบ) จึงเป็นไปไม่ได้',
  crownGridHintPair_regionsCols:
    'สองพื้นที่ที่เน้นไว้จะวางมงกุฎได้แค่ในช่องที่แต้มสี ซึ่งพอดีอยู่ในสองคอลัมน์เท่านั้น — ช่องอื่นในสองคอลัมน์นั้น (มีกรอบ) จึงเป็นไปไม่ได้',
  crownGridHintPair_rowsRegions:
    'สองแถวที่เน้นไว้จะวางมงกุฎได้แค่ในช่องที่แต้มสี ซึ่งพอดีอยู่ในสองพื้นที่เท่านั้น — ช่องอื่นในสองพื้นที่นั้น (มีกรอบ) จึงเป็นไปไม่ได้',
  crownGridHintPair_colsRegions:
    'สองคอลัมน์ที่เน้นไว้จะวางมงกุฎได้แค่ในช่องที่แต้มสี ซึ่งพอดีอยู่ในสองพื้นที่เท่านั้น — ช่องอื่นในสองพื้นที่นั้น (มีกรอบ) จึงเป็นไปไม่ได้',
  crownGridHintHypothesis_row:
    'ลองวางมงกุฎในช่องที่มีกรอบดู การเดินที่ถูกบังคับตามมาจะทำให้แถวที่เน้นไว้ไม่เหลือที่สำหรับมงกุฎเลย ดังนั้นช่องนี้เป็นไปไม่ได้',
  crownGridHintHypothesis_col:
    'ลองวางมงกุฎในช่องที่มีกรอบดู การเดินที่ถูกบังคับตามมาจะทำให้คอลัมน์ที่เน้นไว้ไม่เหลือที่สำหรับมงกุฎเลย ดังนั้นช่องนี้เป็นไปไม่ได้',
  crownGridHintHypothesis_region:
    'ลองวางมงกุฎในช่องที่มีกรอบดู การเดินที่ถูกบังคับตามมาจะทำให้พื้นที่ที่เน้นไว้ไม่เหลือที่สำหรับมงกุฎเลย ดังนั้นช่องนี้เป็นไปไม่ได้',
  crownGridHintNone: 'ตอนนี้ยังไม่พบตาเดินที่แน่นอน',
  crownGridSolvedTitle: 'สำเร็จ!',
  crownGridSolvedBody: 'ทุกแถว ทุกคอลัมน์ และทุกพื้นที่มีมงกุฎอย่างละหนึ่ง',
  crownGridHintsUsed: 'คำใบ้ที่ใช้',
  crownGridNewBestTime: 'เร็วที่สุดของคุณ',
  crownGridNewBoard: 'กระดานใหม่',
  crownGridDailySection: 'รายวัน',
  crownGridDailiesSolved: 'จำนวนวันที่ผ่าน',
  crownGridStep1Title: 'มงกุฎอย่างละหนึ่ง',
  crownGridStep1Body: 'ทุกแถว ทุกคอลัมน์ และทุกสีมีมงกุฎเพียงหนึ่งอันพอดี',
  crownGridStep2Title: 'มงกุฎไม่ติดกัน',
  crownGridStep2Body: 'มงกุฎสองอันอยู่ติดกันไม่ได้ แม้แต่ในแนวทแยง',
  crownGridStep3Title: 'แตะและลาก',
  crownGridStep3Body: 'แตะช่องเพื่อสลับ × มงกุฎ ว่าง ลากเพื่อใส่ × หลายช่อง ติดขัดไหม ขอคำใบ้ได้',
};
