import type { ConverterInterface } from './converter-interface'
import type { Block, } from 'notionapi-agent/dist/interfaces'
import type { Content, Link } from 'mdast'
import u from 'unist-builder'

export default class Video implements ConverterInterface {
    supportsNotionBlock(block: Block): block is Block.Video {
        return (block as Block.Video).type === 'video'
    }

    supportsMdastNode(node: Content): boolean {
        return false
    }

    toMdastNode(block: Block.Video): Content {
        const {format} = block
        return u('link', {
            url: format.display_source,
            children: [{
                type: 'text',
                value: format.display_source
            }]
        }) as Link
    }
}
