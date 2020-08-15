import { Content} from 'mdast'
import type { Block } from 'notionapi-agent/dist/interfaces'
import { RecordMap } from '../types'

export interface ConverterInterface {
    supportsNotionBlock(block: Block): boolean
    supportsMdastNode(node: Content): boolean
    toMdastNode(block: Block, previousNode: Content, recordMap: RecordMap): Content
    toNotionBlock?(node: Content, previousBlock: Block, recordMap: RecordMap): Block
}