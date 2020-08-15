import type { ConverterInterface } from './converter-interface'
import type { Block, } from 'notionapi-agent/dist/interfaces'
import type { Content, Image as ImageNode } from 'mdast'
import u from 'unist-builder'

export default class Image implements ConverterInterface {
    supportsNotionBlock(block: Block): block is Block.Image {
        return (block as Block.Image).type === 'image'
    }

    supportsMdastNode(node: Content): node is ImageNode {
        return (node as ImageNode).type === 'image'
    }

    toMdastNode(block: Block.Image): Content {
        const {format} = block
        return u('image', {
            url: `https://www.notion.so/image/${encodeURIComponent(format.display_source)}`,
            title: "",
            alt: ""
        }) as ImageNode
    }
}
