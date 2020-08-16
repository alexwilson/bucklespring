import  {Plugin } from 'unified'
import { Root } from 'mdast'
import type { Block, SemanticString, NotionUser } from 'notionapi-agent/dist/interfaces'
import type { BlockRecord } from 'notionapi-agent/dist/interfaces/notion-api/v3/Record'
import u from 'unist-builder'
import type { PageChunk, RecordMap } from './types'
import Converter from './converter'
import { ConverterInterface } from './converter/converter-interface'

type Options = {
    converters?: ConverterInterface[]
}
function notionToMdast(options: Options = {}) {
    this.Parser = parser

    const converter = new Converter()
    if (options.converters) {
        options.converters.forEach(converter.addConverter)
    }

    function parser(doc: string): Root {
        const pageChunk = JSON.parse(doc) as PageChunk
        const { recordMap, recordMap: { block } } = pageChunk

        const blocks: Block[] = []
        
        // If this page is part of a database/collection, it has a Page record
        const pageBlock: {value: Block.Page}|undefined = Object.values(block).find(
                ({value: {alive, type}}: BlockRecord) => (alive === true && type === 'page')
        ) as {value: Block.Page}|undefined

        // Populate the blocks in this page.
        if (pageBlock && pageBlock.value && pageBlock.value.content) {
            // When this page is in a database, we reference the blocks belonging to the current page
            blocks.push(
                pageBlock.value,
                ...pageBlock.value.content.map((id: string) => block[id].value)
            )
        } else {
            // Otherwise we use every block
            blocks.push(
                ...Object.values(block).map(b => b.value).filter(b => b.alive === true)
            )
        }

        // Begin MDAST
        const tree: Root = u('root', [])

        // Push nodes into the root-node.
        let previousNode
        for (const currentBlock of blocks) {
            const newNode = converter.toMdastNode(currentBlock, previousNode, recordMap)

            // Allow nodes to interact with their predecessor sibling
            if (newNode !== previousNode) {
                tree.children.push(newNode)
                previousNode = newNode
            }
        }

        return tree
    }
}

export {notionToMdast}