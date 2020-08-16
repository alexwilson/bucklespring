import fs from 'fs'
import path from 'path'
import {getNotionPage} from '../src/helper/notion-api'
import {v4} from 'uuid'

const anonymiseEmails = (doc: string): string => {
    // Important note! Do not trust or re-use this regex for more important use-cases!
    // This is *not* fully RFC valid, however it's "good enough" for generating tests
    // as they are manually reviewed.
    const testEmail = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi
    const emails = [...new Set(doc.match(testEmail))]

    for (const email of emails) {
        doc = doc.replace(new RegExp(email, 'g'), 'example@example.org')
    }

    return doc
}

const anonymiseUuids = (doc: string): string => {
    // Important note! Do not trust or re-use this regex for more important use-cases!
    // This will capture all strings similar to UUIDs, without RFC compliancy.
    const testUuid = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi
    const uuids = [...new Set(doc.match(testUuid))]

    for (const uuid of uuids) {
        doc = doc.replace(new RegExp(uuid, 'g'), v4().toString())
    }

    return doc
}

async function main() {
    const kitchenSinkRaw = JSON.stringify(
        await getNotionPage("d08e52c1-1f05-4c27-85bc-e215261fa4dd")
    )
    const kitchenSinkAnonymised = anonymiseUuids(anonymiseEmails(kitchenSinkRaw))

    const kitchenSinkPath = path.resolve(__dirname, '../test/mock', 'kitchen-sink.json')
    fs.writeFileSync(kitchenSinkPath, kitchenSinkAnonymised)
    console.log("Successfully fetched & written Kitchen Sink!")
}
main()