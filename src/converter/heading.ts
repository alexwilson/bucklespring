import type { ConverterInterface } from './converter-interface'
import type { Block } from 'notionapi-agent/dist/interfaces'
import type { Content, Heading as HeadingNode } from 'mdast'
import u from 'unist-builder'
import { parseTextBlock } from './text'

export default class Heading implements ConverterInterface {
    supportsNotionBlock(block: Block): block is Block.Header|Block.SubHeader|Block.SubSubHeader {
        return (block as Block.Header).type === 'header'
            || (block as Block.SubHeader).type === 'sub_header'
            || (block as Block.SubSubHeader).type === 'sub_sub_header'
    }

    supportsMdastNode(node: Content): node is HeadingNode {
        return (node as HeadingNode).type === 'heading'
    }

    toMdastNode(block: Block.Header|Block.SubHeader|Block.SubSubHeader): HeadingNode {
        const {type} = block
        let depth = 4
        
        if (type === 'header') depth = 1
        if (type === 'sub_header') depth = 2
        if (type === 'sub_sub_header') depth = 3

        return u('heading', {
            depth,
            children: parseTextBlock(block.properties.title, false)
        }) as HeadingNode
    }
}