import unified from 'unified'
import frontMatter from 'remark-frontmatter'
import serializeMarkdown from 'remark-stringify'
import { notionToMdast } from '../'
import type { PageChunk } from '../types'

export async function pageChunkToMarkdown(recordMap: PageChunk) {
    const doc = JSON.stringify(recordMap)
    return await unified()
        .use(notionToMdast)
        .use(serializeMarkdown)
        .use(frontMatter)
        .process(doc)
}