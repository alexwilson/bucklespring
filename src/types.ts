import type { Util } from 'notionapi-agent/dist/interfaces'
import type { Map } from 'notionapi-agent/dist/interfaces/notion-api/v3/Map'
import type Record from 'notionapi-agent/dist/interfaces/notion-api/v3/Record'

export interface CursorItem {
    table: Util.Table
    id: Util.UUID
    index: number
}

export interface Cursor {
    stack: CursorItem[][]
}

export interface RecordMap {
    block: Map<Record.BlockRecord>
    collection?: Map<Record.CollectionRecord>
    collection_view?: Map<Record.CollectionViewRecord>
    notion_user: Map<Record.NotionUserRecord>
    space: Map<Record.SpaceRecord>  
}

export interface PageChunk {
    cursor: Cursor,
    recordMap: RecordMap
}