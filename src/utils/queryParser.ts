import type { Question, Tag, Project, FilterState, Status, Difficulty } from '../types'

export type ASTNode =
  | { type: 'AND'; left: ASTNode; right: ASTNode }
  | { type: 'OR'; left: ASTNode; right: ASTNode }
  | { type: 'NOT'; child: ASTNode }
  | { type: 'DIRECTIVE'; field: 'project' | 'status' | 'difficulty' | 'tag'; value: string }
  | { type: 'TEXT'; query: string }

export type SetQueryNode =
  | { type: 'UNION'; left: SetQueryNode; right: SetQueryNode }
  | { type: 'SLICE'; child: SetQueryNode; start?: number; end?: number }
  | { type: 'RANDOM'; child: SetQueryNode; count: number; seed?: number }
  | { type: 'FILTER'; ast: ASTNode }

type TokenType =
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'UNION'
  | 'RANDOM'
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'COLON'
  | 'COMMA'
  | 'NUMBER'
  | 'DIRECTIVE'
  | 'TEXT'
  | 'EOF'

interface Token {
  type: TokenType
  value: string
  field?: 'project' | 'status' | 'difficulty' | 'tag'
  start: number
  end: number
}

// ─── Tokenizer ────────────────────────────────────────────────────────────────

export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const len = input.length

  while (i < len) {
    const ch = input[i]

    if (/\s/.test(ch)) {
      i++
      continue
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', start: i, end: i + 1 })
      i++
      continue
    }

    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', start: i, end: i + 1 })
      i++
      continue
    }

    if (ch === '[') {
      tokens.push({ type: 'LBRACKET', value: '[', start: i, end: i + 1 })
      i++
      continue
    }

    if (ch === ']') {
      tokens.push({ type: 'RBRACKET', value: ']', start: i, end: i + 1 })
      i++
      continue
    }

    if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ',', start: i, end: i + 1 })
      i++
      continue
    }

    if (ch === ':') {
      tokens.push({ type: 'COLON', value: ':', start: i, end: i + 1 })
      i++
      continue
    }

    // Directives: @field:value or @field:"value"
    if (ch === '@') {
      const match = input.slice(i).match(/^@(project|status|difficulty|tag):/i)
      if (match) {
        const field = match[1].toLowerCase() as 'project' | 'status' | 'difficulty' | 'tag'
        const prefixLen = match[0].length
        let valStart = i + prefixLen
        let valEnd = valStart
        let value = ''

        if (valStart < len && (input[valStart] === '"' || input[valStart] === "'")) {
          const quote = input[valStart]
          valStart++
          valEnd = valStart
          while (valEnd < len && input[valEnd] !== quote) {
            valEnd++
          }
          value = input.slice(valStart, valEnd)
          if (valEnd < len && input[valEnd] === quote) {
            valEnd++
          }
        } else {
          while (valEnd < len && !/\s|[()[\]:,]/.test(input[valEnd])) {
            valEnd++
          }
          value = input.slice(valStart, valEnd)
        }

        tokens.push({
          type: 'DIRECTIVE',
          field,
          value,
          start: i,
          end: valEnd,
        })
        i = valEnd
        continue
      }
    }

    // Quoted free text
    if (ch === '"' || ch === "'") {
      const quote = ch
      const textStart = i + 1
      let textEnd = textStart
      while (textEnd < len && input[textEnd] !== quote) {
        textEnd++
      }
      const val = input.slice(textStart, textEnd)
      tokens.push({
        type: 'TEXT',
        value: val,
        start: i,
        end: textEnd < len ? textEnd + 1 : textEnd,
      })
      i = textEnd < len ? textEnd + 1 : textEnd
      continue
    }

    // Bare word: check for number, operators, or text
    const wordStart = i
    while (i < len && !/\s|[()[\]:,]/.test(input[i])) {
      i++
    }
    const word = input.slice(wordStart, i)
    const upper = word.toUpperCase()

    if (/^\d+$/.test(word)) {
      tokens.push({ type: 'NUMBER', value: word, start: wordStart, end: i })
    } else if (upper === 'UNION' || upper === 'JOIN') {
      tokens.push({ type: 'UNION', value: word, start: wordStart, end: i })
    } else if (upper === 'RANDOM' || upper === 'SAMPLE') {
      tokens.push({ type: 'RANDOM', value: word, start: wordStart, end: i })
    } else if (upper === 'AND' || word === '&&') {
      tokens.push({ type: 'AND', value: word, start: wordStart, end: i })
    } else if (upper === 'OR' || word === '||') {
      tokens.push({ type: 'OR', value: word, start: wordStart, end: i })
    } else if (upper === 'NOT' || word === '!') {
      tokens.push({ type: 'NOT', value: word, start: wordStart, end: i })
    } else {
      tokens.push({ type: 'TEXT', value: word, start: wordStart, end: i })
    }
  }

  tokens.push({ type: 'EOF', value: '', start: len, end: len })
  return tokens
}

// ─── Boolean AST Recursive Descent Parser ─────────────────────────────────────

export function parseQuery(input: string): ASTNode | null {
  const tokens = tokenize(input)
  if (tokens.length <= 1) return null

  let pos = 0

  function peek(): Token {
    return tokens[pos] || { type: 'EOF', value: '', start: 0, end: 0 }
  }

  function consume(): Token {
    return tokens[pos++]
  }

  function parseOr(): ASTNode | null {
    let left = parseAnd()
    if (!left) return null

    while (peek().type === 'OR') {
      consume()
      const right = parseAnd()
      if (!right) break
      left = { type: 'OR', left, right }
    }

    return left
  }

  function parseAnd(): ASTNode | null {
    let left = parseUnary()
    if (!left) return null

    while (true) {
      const p = peek()
      if (p.type === 'OR' || p.type === 'RPAREN' || p.type === 'EOF' || p.type === 'UNION') {
        break
      }

      if (p.type === 'AND') {
        consume()
      }

      const right = parseUnary()
      if (!right) break
      left = { type: 'AND', left, right }
    }

    return left
  }

  function parseUnary(): ASTNode | null {
    if (peek().type === 'NOT') {
      consume()
      const child = parseUnary()
      if (!child) return null
      return { type: 'NOT', child }
    }
    return parsePrimary()
  }

  function parsePrimary(): ASTNode | null {
    const t = peek()

    if (t.type === 'LPAREN') {
      consume()
      const expr = parseOr()
      if (peek().type === 'RPAREN') {
        consume()
      }
      return expr
    }

    if (t.type === 'DIRECTIVE') {
      consume()
      return {
        type: 'DIRECTIVE',
        field: t.field!,
        value: t.value,
      }
    }

    if (t.type === 'TEXT' || t.type === 'NUMBER') {
      consume()
      return {
        type: 'TEXT',
        query: t.value,
      }
    }

    return null
  }

  try {
    return parseOr()
  } catch {
    return null
  }
}

// ─── Set Query Parser (Set Operations, Slicing, Random Sampling) ───────────────

export function parseSetQuery(input: string): SetQueryNode | null {
  const tokens = tokenize(input)
  if (tokens.length <= 1) return null

  let pos = 0

  function peek(): Token {
    return tokens[pos] || { type: 'EOF', value: '', start: 0, end: 0 }
  }

  function consume(): Token {
    return tokens[pos++]
  }

  // 1. UnionExpression := SlicedExpression ( 'UNION' SlicedExpression )*
  function parseUnion(): SetQueryNode | null {
    let left = parseSliced()
    if (!left) return null

    while (peek().type === 'UNION') {
      consume() // consume UNION / JOIN
      const right = parseSliced()
      if (!right) break
      left = { type: 'UNION', left, right }
    }

    return left
  }

  // 2. SlicedExpression := PrimarySet ( '[' [NUMBER] ':' [NUMBER] ']' )*
  function parseSliced(): SetQueryNode | null {
    let child = parsePrimarySet()
    if (!child) return null

    while (peek().type === 'LBRACKET') {
      consume() // consume [
      let start: number | undefined = undefined
      let end: number | undefined = undefined

      if (peek().type === 'NUMBER') {
        start = parseInt(consume().value, 10)
      }

      if (peek().type === 'COLON') {
        consume() // consume :
        if (peek().type === 'NUMBER') {
          end = parseInt(consume().value, 10)
        }
      } else {
        // If someone wrote [40] instead of [:40], treat as limit 40
        end = start
        start = 0
      }

      if (peek().type === 'RBRACKET') {
        consume() // consume ]
      }

      child = { type: 'SLICE', child, start, end }
    }

    return child
  }

  // 3. PrimarySet := RANDOM '(' SetQuery ',' NUMBER [',' NUMBER] ')' | '(' SetQuery ')' | BooleanFilter
  function parsePrimarySet(): SetQueryNode | null {
    const t = peek()

    // RANDOM(subquery, count, seed?)
    if (t.type === 'RANDOM') {
      consume() // consume RANDOM
      if (peek().type !== 'LPAREN') return null
      consume() // consume (

      const child = parseUnion()
      if (!child) return null

      if (peek().type !== 'COMMA') return null
      consume() // consume ,

      if (peek().type !== 'NUMBER') return null
      const count = parseInt(consume().value, 10)

      let seed: number | undefined = undefined
      if (peek().type === 'COMMA') {
        consume() // consume ,
        if (peek().type === 'NUMBER') {
          seed = parseInt(consume().value, 10)
        }
      }

      if (peek().type === 'RPAREN') {
        consume() // consume )
      }

      return { type: 'RANDOM', child, count, seed }
    }

    // Parenthesized expression: check if it wraps a multi-set query
    if (t.type === 'LPAREN') {
      const savedPos = pos
      consume() // consume (
      const inner = parseUnion()
      if (inner && inner.type !== 'FILTER' && peek().type === 'RPAREN') {
        consume() // consume )
        return inner
      }
      // If inner has no set operations, backtrack so parseBooleanAST handles full boolean logic
      pos = savedPos
    }

    // Boolean filter
    const ast = parseBooleanAST()
    if (ast) {
      return { type: 'FILTER', ast }
    }

    return null
  }

  // Parse boolean AST up to set boundaries (UNION, LBRACKET, COMMA, EOF)
  function parseBooleanAST(): ASTNode | null {
    function parseOr(): ASTNode | null {
      let left = parseAnd()
      if (!left) return null

      while (peek().type === 'OR') {
        consume()
        const right = parseAnd()
        if (!right) break
        left = { type: 'OR', left, right }
      }

      return left
    }

    function parseAnd(): ASTNode | null {
      let left = parseUnary()
      if (!left) return null

      while (true) {
        const p = peek()
        if (
          p.type === 'OR' ||
          p.type === 'RPAREN' ||
          p.type === 'EOF' ||
          p.type === 'UNION' ||
          p.type === 'LBRACKET' ||
          p.type === 'COMMA'
        ) {
          break
        }

        if (p.type === 'AND') {
          consume()
        }

        const right = parseUnary()
        if (!right) break
        left = { type: 'AND', left, right }
      }

      return left
    }

    function parseUnary(): ASTNode | null {
      if (peek().type === 'NOT') {
        consume()
        const child = parseUnary()
        if (!child) return null
        return { type: 'NOT', child }
      }
      return parsePrimary()
    }

    function parsePrimary(): ASTNode | null {
      const p = peek()

      if (p.type === 'LPAREN') {
        consume()
        const expr = parseOr()
        if (peek().type === 'RPAREN') {
          consume()
        }
        return expr
      }

      if (p.type === 'DIRECTIVE') {
        consume()
        return {
          type: 'DIRECTIVE',
          field: p.field!,
          value: p.value,
        }
      }

      if (p.type === 'TEXT' || p.type === 'NUMBER') {
        consume()
        return {
          type: 'TEXT',
          query: p.value,
        }
      }

      return null
    }

    return parseOr()
  }

  try {
    return parseUnion()
  } catch {
    return null
  }
}

// ─── PRNG & Shuffle Utilities ─────────────────────────────────────────────────

function hashStringToNumber(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function mulberry32(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function seededShuffle<T>(array: T[], seed: number): T[] {
  const arr = [...array]
  const rng = mulberry32(seed)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const temp = arr[i]
    arr[i] = arr[j]
    arr[j] = temp
  }
  return arr
}

// ─── Query Evaluators ─────────────────────────────────────────────────────────

export function evaluateQueryAST(
  node: ASTNode | null,
  q: Question,
  tagMap: Map<string, Tag>,
  projectMap: Map<string, Project>
): boolean {
  if (!node) return true

  switch (node.type) {
    case 'AND':
      return (
        evaluateQueryAST(node.left, q, tagMap, projectMap) &&
        evaluateQueryAST(node.right, q, tagMap, projectMap)
      )

    case 'OR':
      return (
        evaluateQueryAST(node.left, q, tagMap, projectMap) ||
        evaluateQueryAST(node.right, q, tagMap, projectMap)
      )

    case 'NOT':
      return !evaluateQueryAST(node.child, q, tagMap, projectMap)

    case 'DIRECTIVE': {
      const val = node.value.trim().toLowerCase()
      if (!val) return true

      if (node.field === 'project') {
        if (!q.projectId) return val === 'none' || val === 'null'
        if (q.projectId.toLowerCase() === val) return true
        const proj = projectMap.get(q.projectId)
        if (!proj) return false
        return (
          proj.name.toLowerCase() === val ||
          proj.name.toLowerCase().includes(val)
        )
      }

      if (node.field === 'status') {
        return q.status.toLowerCase() === val
      }

      if (node.field === 'difficulty') {
        return q.difficulty.toLowerCase() === val
      }

      if (node.field === 'tag') {
        const proj = q.projectId ? projectMap.get(q.projectId) : null
        const effectiveTagIds = new Set([...q.tagIds, ...(proj?.tagIds ?? [])])

        for (const tagId of effectiveTagIds) {
          if (tagId.toLowerCase() === val) return true
          const tag = tagMap.get(tagId)
          if (tag && (tag.name.toLowerCase() === val || tag.name.toLowerCase().includes(val))) {
            return true
          }
        }
        return false
      }

      return true
    }

    case 'TEXT': {
      const needle = node.query.trim().toLowerCase()
      if (!needle) return true

      const allMarkdown = [
        ...q.questionContent.segments,
        ...q.solutionContent.segments,
      ]
        .filter(s => s.type === 'markdown')
        .map(s => (s as any).text ?? '')
        .join(' ')
        .toLowerCase()

      const source = (q.source ?? '').toLowerCase()
      return allMarkdown.includes(needle) || source.includes(needle)
    }

    default:
      return true
  }
}

export function executeSetQuery(
  node: SetQueryNode | null,
  allQuestions: Question[],
  tagMap: Map<string, Tag>,
  projectMap: Map<string, Project>,
  sessionSeed?: number | string
): Question[] {
  if (!node) return allQuestions

  switch (node.type) {
    case 'FILTER':
      return allQuestions.filter(q => evaluateQueryAST(node.ast, q, tagMap, projectMap))

    case 'SLICE': {
      const list = executeSetQuery(node.child, allQuestions, tagMap, projectMap, sessionSeed)
      const start = node.start ?? 0
      const end = node.end !== undefined ? node.end : list.length
      return list.slice(start, end)
    }

    case 'RANDOM': {
      const list = executeSetQuery(node.child, allQuestions, tagMap, projectMap, sessionSeed)
      let seedNum: number
      if (node.seed !== undefined) {
        seedNum = node.seed
      } else if (typeof sessionSeed === 'number') {
        seedNum = sessionSeed
      } else if (typeof sessionSeed === 'string') {
        seedNum = hashStringToNumber(sessionSeed)
      } else {
        seedNum = 42
      }
      const shuffled = seededShuffle(list, seedNum)
      return shuffled.slice(0, Math.max(0, node.count))
    }

    case 'UNION': {
      const left = executeSetQuery(node.left, allQuestions, tagMap, projectMap, sessionSeed)
      const right = executeSetQuery(node.right, allQuestions, tagMap, projectMap, sessionSeed)
      const seen = new Set<string>()
      const result: Question[] = []
      for (const q of left) {
        if (!seen.has(q.id)) {
          seen.add(q.id)
          result.push(q)
        }
      }
      for (const q of right) {
        if (!seen.has(q.id)) {
          seen.add(q.id)
          result.push(q)
        }
      }
      return result
    }

    default:
      return allQuestions
  }
}

// ─── Serializer (FilterState -> Query String) ─────────────────────────────────

export function serializeFilterToQuery(
  filter: FilterState,
  projectMap: Map<string, Project>,
  tagMap: Map<string, Tag>
): string {
  const parts: string[] = []

  // Projects
  const activeProjectIds = filter.projectIds && filter.projectIds.length > 0
    ? filter.projectIds
    : filter.projectId && filter.projectId !== 'all'
    ? [filter.projectId]
    : []

  if (activeProjectIds.length > 0) {
    const projectTerms = activeProjectIds.map(id => {
      const proj = projectMap.get(id)
      const name = proj?.name ?? id
      return name.includes(' ') ? `@project:"${name}"` : `@project:${name}`
    })
    if (projectTerms.length === 1) {
      parts.push(projectTerms[0])
    } else {
      parts.push(`(${projectTerms.join(' OR ')})`)
    }
  }

  // Statuses
  if (filter.statuses && filter.statuses.length > 0) {
    const statusTerms = filter.statuses.map(s => `@status:${s}`)
    if (statusTerms.length === 1) {
      parts.push(statusTerms[0])
    } else {
      parts.push(`(${statusTerms.join(' OR ')})`)
    }
  }

  // Difficulties
  if (filter.difficulties && filter.difficulties.length > 0) {
    const diffTerms = filter.difficulties.map(d => `@difficulty:${d}`)
    if (diffTerms.length === 1) {
      parts.push(diffTerms[0])
    } else {
      parts.push(`(${diffTerms.join(' OR ')})`)
    }
  }

  // Tags
  if (filter.tagIds && filter.tagIds.length > 0) {
    const tagTerms = filter.tagIds.map(id => {
      const t = tagMap.get(id)
      const name = t?.name ?? id
      return name.includes(' ') ? `@tag:"${name}"` : `@tag:${name}`
    })
    const joiner = filter.tagMode === 'or' ? ' OR ' : ' AND '
    if (tagTerms.length === 1) {
      parts.push(tagTerms[0])
    } else {
      parts.push(`(${tagTerms.join(joiner)})`)
    }
  }

  // Text search
  if (filter.textSearch && filter.textSearch.trim()) {
    const text = filter.textSearch.trim()
    parts.push(text.includes(' ') ? `"${text}"` : text)
  }

  return parts.join(' AND ')
}

// ─── Try Parse Query to Canonical FilterState ─────────────────────────────────

export function tryExtractFilterState(
  query: string,
  projects: Project[],
  tags: Tag[]
): Partial<FilterState> {
  const tokens = tokenize(query)
  const projectIds = new Set<string>()
  const statuses = new Set<Status>()
  const difficulties = new Set<Difficulty>()
  const tagIds = new Set<string>()
  const textParts: string[] = []

  const projByName = new Map<string, string>()
  for (const p of projects) {
    projByName.set(p.name.toLowerCase(), p.id)
    projByName.set(p.id.toLowerCase(), p.id)
  }

  const tagByName = new Map<string, string>()
  for (const t of tags) {
    tagByName.set(t.name.toLowerCase(), t.id)
    tagByName.set(t.id.toLowerCase(), t.id)
  }

  for (const tok of tokens) {
    if (tok.type === 'DIRECTIVE') {
      const val = tok.value.toLowerCase()
      if (tok.field === 'project') {
        const id = projByName.get(val)
        if (id) projectIds.add(id)
        else {
          const found = projects.find(p => p.name.toLowerCase().includes(val))
          if (found) projectIds.add(found.id)
        }
      } else if (tok.field === 'status') {
        if (['unattempted', 'wrong', 'partial', 'correct'].includes(val)) {
          statuses.add(val as Status)
        }
      } else if (tok.field === 'difficulty') {
        if (['easy', 'medium', 'hard', 'unseen'].includes(val)) {
          difficulties.add(val as Difficulty)
        }
      } else if (tok.field === 'tag') {
        const id = tagByName.get(val)
        if (id) tagIds.add(id)
        else {
          const found = tags.find(t => t.name.toLowerCase().includes(val))
          if (found) tagIds.add(found.id)
        }
      }
    } else if (tok.type === 'TEXT') {
      textParts.push(tok.value)
    }
  }

  const projArr = Array.from(projectIds)
  return {
    projectIds: projArr,
    projectId: projArr.length === 1 ? projArr[0] : projArr.length === 0 ? 'all' : (projArr[0] as any),
    statuses: Array.from(statuses),
    difficulties: Array.from(difficulties),
    tagIds: Array.from(tagIds),
    textSearch: textParts.join(' '),
    rawQuery: query,
  }
}

// ─── Autocompletions ──────────────────────────────────────────────────────────

export interface AutocompleteItem {
  label: string
  insertText: string
  type: 'directive' | 'project' | 'status' | 'difficulty' | 'tag' | 'operator'
  description?: string
  color?: string
}

export function getAutocompletions(
  query: string,
  cursor: number,
  projects: Project[],
  tags: Tag[]
): { items: AutocompleteItem[]; replaceRange: [number, number] } {
  const left = query.slice(0, cursor)

  // 1. Check if cursor is inside or right after a directive:
  const lastAtIndex = left.lastIndexOf('@')
  if (lastAtIndex !== -1) {
    const afterAt = left.slice(lastAtIndex)
    const directiveMatch = afterAt.match(/^@([a-z]*)(?::\s*(["']?)([^"'\s]*))?$/i)
    if (directiveMatch) {
      const fieldPrefix = directiveMatch[1].toLowerCase()
      const hasColon = afterAt.includes(':')
      const valPrefix = (directiveMatch[3] || '').trim().toLowerCase()
      const tokenStart = lastAtIndex

      if (!hasColon) {
        const directives: AutocompleteItem[] = [
          { label: '@project:', insertText: '@project:', type: 'directive', description: 'Filter by project' },
          { label: '@status:', insertText: '@status:', type: 'directive', description: 'Filter by status' },
          { label: '@difficulty:', insertText: '@difficulty:', type: 'directive', description: 'Filter by difficulty' },
          { label: '@tag:', insertText: '@tag:', type: 'directive', description: 'Filter by question tag' },
        ]
        const filtered = directives.filter(d => d.label.toLowerCase().startsWith('@' + fieldPrefix))
        return { items: filtered, replaceRange: [tokenStart, cursor] }
      }

      if (fieldPrefix.startsWith('proj')) {
        const items: AutocompleteItem[] = projects
          .filter(p => !valPrefix || p.name.toLowerCase().includes(valPrefix))
          .map(p => ({
            label: p.name,
            insertText: p.name.includes(' ') ? `@project:"${p.name}" ` : `@project:${p.name} `,
            type: 'project',
            description: 'Project',
            color: p.color,
          }))
        return { items, replaceRange: [tokenStart, cursor] }
      }

      if (fieldPrefix.startsWith('stat')) {
        const statuses: { name: Status; color: string }[] = [
          { name: 'wrong', color: '#f43f5e' },
          { name: 'partial', color: '#f59e0b' },
          { name: 'correct', color: '#10b981' },
          { name: 'unattempted', color: '#5a5a80' },
        ]
        const items: AutocompleteItem[] = statuses
          .filter(s => !valPrefix || s.name.toLowerCase().startsWith(valPrefix))
          .map(s => ({
            label: s.name,
            insertText: `@status:${s.name} `,
            type: 'status',
            description: 'Status',
            color: s.color,
          }))
        return { items, replaceRange: [tokenStart, cursor] }
      }

      if (fieldPrefix.startsWith('diff')) {
        const diffs: { name: Difficulty; color: string }[] = [
          { name: 'easy', color: '#10b981' },
          { name: 'medium', color: '#0ea5e9' },
          { name: 'hard', color: '#f43f5e' },
          { name: 'unseen', color: '#8b5cf6' },
        ]
        const items: AutocompleteItem[] = diffs
          .filter(d => !valPrefix || d.name.toLowerCase().startsWith(valPrefix))
          .map(d => ({
            label: d.name,
            insertText: `@difficulty:${d.name} `,
            type: 'difficulty',
            description: 'Difficulty',
            color: d.color,
          }))
        return { items, replaceRange: [tokenStart, cursor] }
      }

      if (fieldPrefix.startsWith('tag')) {
        const items: AutocompleteItem[] = tags
          .filter(t => !valPrefix || t.name.toLowerCase().includes(valPrefix))
          .map(t => ({
            label: t.name,
            insertText: t.name.includes(' ') ? `@tag:"${t.name}" ` : `@tag:${t.name} `,
            type: 'tag',
            description: 'Tag',
            color: t.color,
          }))
        return { items, replaceRange: [tokenStart, cursor] }
      }
    }
  }

  // 2. If preceded by whitespace (or at start or after open paren):
  if (/\s+$/.test(left) || left.length === 0 || /\($/.test(left.trim())) {
    const hasPriorTerms = left.trim().length > 0 && !/\($/.test(left.trim())
    const items: AutocompleteItem[] = []

    if (hasPriorTerms) {
      items.push(
        { label: 'AND', insertText: 'AND ', type: 'operator', description: 'Intersection' },
        { label: 'OR', insertText: 'OR ', type: 'operator', description: 'Union condition' },
        { label: 'UNION', insertText: 'UNION ', type: 'operator', description: 'Combine query sets (deduplicated)' },
        { label: 'join', insertText: 'join ', type: 'operator', description: 'Combine query sets' },
        { label: '[:40]', insertText: '[:40] ', type: 'operator', description: 'Slice first 40 questions' },
      )
    }

    items.push(
      { label: 'random(', insertText: 'random(', type: 'operator', description: 'Random sample: random(query, count, seed?)' },
      { label: 'NOT', insertText: 'NOT ', type: 'operator', description: 'Negation' },
      { label: '@project:', insertText: '@project:', type: 'directive', description: 'Filter by project' },
      { label: '@status:', insertText: '@status:', type: 'directive', description: 'Filter by status' },
      { label: '@difficulty:', insertText: '@difficulty:', type: 'directive', description: 'Filter by difficulty' },
      { label: '@tag:', insertText: '@tag:', type: 'directive', description: 'Filter by tag' },
    )

    return { items, replaceRange: [cursor, cursor] }
  }

  // 3. If typing an operator or keyword at the end:
  const wordMatch = left.match(/(?:^|\s|\()([a-z0-9_:[\]]+)$/i)
  if (wordMatch) {
    const word = wordMatch[1].toUpperCase()
    const tokenStart = cursor - wordMatch[1].length
    const operators: AutocompleteItem[] = [
      { label: 'AND', insertText: 'AND ', type: 'operator', description: 'Intersection' },
      { label: 'OR', insertText: 'OR ', type: 'operator', description: 'Union condition' },
      { label: 'UNION', insertText: 'UNION ', type: 'operator', description: 'Combine query sets' },
      { label: 'join', insertText: 'join ', type: 'operator', description: 'Combine query sets' },
      { label: 'random(', insertText: 'random(', type: 'operator', description: 'Random sample: random(query, count, seed?)' },
      { label: 'NOT', insertText: 'NOT ', type: 'operator', description: 'Negation' },
    ]
    const matchedOps = operators.filter(op => op.label.toUpperCase().startsWith(word))
    if (matchedOps.length > 0) {
      return { items: matchedOps, replaceRange: [tokenStart, cursor] }
    }
  }

  return { items: [], replaceRange: [cursor, cursor] }
}
