/**
 * 배수로 명칭 또는 코드에서 시설 고유 일련번호(숫자)를 안전하게 추출하는 유틸리티
 * 
 * 중요: '본관4층-1', '본관3층-15' 등의 명칭에서 층수('4층', '3층')의 숫자를 배수로 번호로 오인하지 않고,
 * 실제 배수로 고유 번호('1', '15')를 정확하게 추출합니다.
 */
export function extractDitchNumberStr(name: string = '', code: string = ''): string {
  // 1. '4층', '3층', '4F', '3F' 등 층수 표기에서 숫자를 먼저 제거하여 분리
  const cleanName = (name || '').replace(/\d+\s*(?:층|F|f)/gi, '');
  const nameNumbers = cleanName.match(/\d+/g);
  if (nameNumbers && nameNumbers.length > 0) {
    return nameNumbers[nameNumbers.length - 1];
  }

  // 2. name에서 번호를 찾지 못한 경우 code에서 탐색
  const cleanCode = (code || '').replace(/\d+\s*(?:층|F|f)/gi, '');
  const codeNumbers = cleanCode.match(/\d+/g);
  if (codeNumbers && codeNumbers.length > 0) {
    return codeNumbers[codeNumbers.length - 1];
  }

  // 3. 최후의 수단: 원래 문자열에서 가장 마지막 번호 추출
  const rawNumbers = `${name} ${code}`.match(/\d+/g);
  return rawNumbers ? rawNumbers[rawNumbers.length - 1] : '1';
}

export function extractDitchNumber(name: string = '', code: string = ''): number {
  const str = extractDitchNumberStr(name, code);
  const n = parseInt(str, 10);
  return isNaN(n) ? 1 : n;
}
