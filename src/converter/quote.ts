import type { ConverterInterface } from './converter-interface'
import type { Block } from 'notionapi-agent/dist/interfaces'
import type { Content, Blockquote, Paragraph, Text } from 'mdast'
import u from 'unist-builder'
import { parseTextBlock } from './text'

export default class Quote implements ConverterInterface {
    supportsNotionBlock(block: Block): block is Block.Quote|Block.Callout {
        return (block as Block.Quote).type === 'quote'
            || (block as Block.Callout).type === 'callout'
    }

    supportsMdastNode(node: Content): node is Blockquote {
        return (node as Blockquote).type === 'blockquote'
    }

    toMdastNode(block: Block.Quote|Block.Callout): Blockquote {
        const text = ('properties' in block && 'title' in block.properties) ? parseTextBlock(block.properties.title) : []

        if ((block as Block.Callout).type === 'callout') {
            if (block.format.page_icon) {
                text.unshift(u('text', `${block.format.page_icon} `))
            }
        }

        const blockquote = u('blockquote', [
            u('paragraph', text) as Paragraph
        ]) as Blockquote
        blockquote.blockType = block.type
        return blockquote
    }
}
