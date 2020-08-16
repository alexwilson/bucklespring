import  { Plugin } from 'unified'
import { Root, Content } from 'mdast'
import type { Block } from 'notionapi-agent/dist/interfaces'
import type { BlockRecord } from 'notionapi-agent/dist/interfaces/notion-api/v3/Record'
import u from 'unist-builder'
import type { PageChunk, RecordMap } from './types'
import Converter from './converter'
import { ConverterInterface } from './converter/converter-interface'

type Options = {
    converters?: ConverterInterface[],
    withBlockFormat?: boolean,
    withBlockType?: boolean,
    type: 'recordMap'
}
const defaultOptions: Options = {
    withBlockFormat: true,
    withBlockType: true,
    type: 'recordMap'
}

export function notionToMdast(options: Options = defaultOptions) {    
    const configuration = Object.assign({}, options, defaultOptions)
    this.Parser = parser

    const documentType = configuration.type
    const converter = new Converter()
    if (configuration.converters) {
        configuration.converters.forEach(converter.addConverter)
    }

    function parser(doc: string): Root {
        const document = JSON.parse(doc) as PageChunk

        let recordMap: RecordMap
        let blocks: Block[]

        switch(documentType) {
            case 'recordMap': {
                recordMap = document.recordMap
                blocks = blocksFromRecordMap(recordMap)
                break
            }
        }

        // Begin MDAST
        const tree: Root = u('root', [])

        // Push nodes into the root-node.
        let previousNode = Object.create(null) as Content
        for (const block of blocks) {

            const newNode = converter.toMdastNode(block, previousNode, recordMap)

            if (options.withBlockFormat !== false) {
                newNode._blockFormat = block.format
            }

            if (options.withBlockType !== false) {
                newNode._blockType = block.type
            }

            // Allow nodes to interact with their predecessor sibling
            if (newNode !== previousNode) {
                tree.children.push(newNode)
                previousNode = newNode
            }
        }

        return tree
    }
}

function blocksFromRecordMap(recordMap: RecordMap): Block[] {
    let blocks: Block[]

    // Find all "Alive" blocks in RecordMap
    blocks = Object
        .values(recordMap.block)
        .map(({value}: BlockRecord) => value)
        .filter(({alive}) => alive === true)
        
    // If this page is part of a database/collection, it has a Page record
    // which we use to scope blocks to *only* the current page.
    const pageBlock: Block.Page|undefined = blocks.find(
            ({alive, type}: Block) => (type === 'page' && alive === true)
    ) as Block.Page|undefined
    if (pageBlock && pageBlock.content) {
        // When this page is in a database, we reference the blocks belonging to the current page
        blocks = [
            pageBlock,
            ...blocks.filter((block: Block) => pageBlock.content.includes(block.id))
        ]
    }

    return blocks
}

export default notionToMdast