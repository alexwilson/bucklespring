import type { ConverterInterface } from './converter-interface'
import type { Block, } from 'notionapi-agent/dist/interfaces'
import type { Content, ThematicBreak } from 'mdast'
import u from 'unist-builder'

export default class Divider implements ConverterInterface {
    supportsNotionBlock(block: Block): block is Block.Divider {
        return (block as Block.Divider).type === 'divider'
    }

    supportsMdastNode(node: Content): node is ThematicBreak {
        return (node as ThematicBreak).type === 'thematicBreak'
    }

    toMdastNode(block: Block.Text): ThematicBreak {
        return u('thematicBreak') as ThematicBreak
    }
}
