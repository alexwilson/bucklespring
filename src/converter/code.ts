import type { ConverterInterface } from './converter-interface'
import type { Block, } from 'notionapi-agent/dist/interfaces'
import type { Content, Code as CodeNode } from 'mdast'
import u from 'unist-builder'
import camelcase from 'camelcase'

export default class Code implements ConverterInterface {
    supportsNotionBlock(block: Block): block is Block.Code {
        return (block as Block.Code).type === 'code'
    }

    supportsMdastNode(node: Content): node is CodeNode {
        return (node as CodeNode).type === 'code'
    }

    toMdastNode(block: Block.Code): CodeNode {
        return u('code', {
            lang: camelcase(block.properties.language.flat(Infinity).shift()),
            value: block.properties.title.flat(Infinity).join('\n')
        }) as CodeNode
    }
}
