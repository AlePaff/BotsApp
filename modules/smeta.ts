import Strings from "../lib/db";
import inputSanitization from "../sidekick/input-sanitization";
import { MessageType } from "../sidekick/message-type";
import { downloadContentFromMessage, proto } from "@adiwajshing/baileys";
import Client from "../sidekick/client";
import BotsApp from "../sidekick/sidekick";
import fs from "fs";
import { readFileSync } from 'fs'

import { Transform } from "stream";
import { Sticker, extractMetadata, StickerTypes, Categories } from 'wa-sticker-formatter'

const smeta = Strings.smeta;

function getStickerType(arg: string): StickerTypes {
    if (Object.values(StickerTypes).includes(arg as StickerTypes)) {
        return arg as StickerTypes;
    }
    return StickerTypes.FULL;
}

export = {
    name: "smeta",
    description: smeta.DESCRIPTION,
    extendedDescription: smeta.EXTENDED_DESCRIPTION,
    demo: { isEnabled: false, text: ".smeta" },
    async handle(client: Client, chat: proto.IWebMessageInfo, BotsApp: BotsApp, args: string[]): Promise<void> {

        if (BotsApp.isReplySticker) {



            var replyChatObject: any = {
                message: chat.message.extendedTextMessage.contextInfo.quotedMessage.stickerMessage,
                type: 'sticker'
            };
            var stickerId = chat.message.extendedTextMessage.contextInfo.stanzaId;
            const filePath = "./tmp/convert_to_image-" + stickerId;
            const fileWebp = './tmp/sticker-' + stickerId + '.webp';
            const stream: Transform = await downloadContentFromMessage(replyChatObject.message, replyChatObject.type)
            await inputSanitization.saveBuffer(filePath, stream);

            const stickerRead = readFileSync(filePath)
            let metadata_original = await extractMetadata(stickerRead)

            //no arguments prints metadata
            if (args.length <= 0) {
                await client.sendMessage(
                    BotsApp.chatId,
                    // it prints the metadata in a json format with an enter between each key:value
                    metadata_original != null ? "Metadata:\n\n" + Object.keys(metadata_original).map(key => `${key}: ${metadata_original[key]}`).join('\n') : smeta.NO_METADATA,
                    MessageType.text,
                ).catch(err => inputSanitization.handleError(err, client, BotsApp));
                await inputSanitization.deleteFiles(filePath);
                return
            }

            //if sticker is an animated sticker
            if (chat.message.extendedTextMessage.contextInfo.quotedMessage.stickerMessage.isAnimated) {
                await client.sendMessage(
                    BotsApp.chatId,
                    smeta.CURRENTLY_NOT_SUPPORTED,
                    MessageType.text,
                ).catch(err => inputSanitization.handleError(err, client, BotsApp));
                await inputSanitization.deleteFiles(filePath);
                return
            }

            const validateArguments = (args: string[]): boolean => {
                const keyword = "null"
                for (let i = 0; i < args?.length; i++) {
                    if (args[i] !== keyword) { return false }
                }
                return true;
            }
            //if all arguments are null returns error
            if (validateArguments(args)) {
                await client.sendMessage(
                    BotsApp.chatId,
                    smeta.NO_ARGUMENTS,
                    MessageType.text,
                ).catch(err => inputSanitization.handleError(err, client, BotsApp));
                await inputSanitization.deleteFiles(filePath);
                return
            }
            //it allows more than 1 emoji but its a secret for now (cuz its too picky and buggy)
            //convert from string separate by commas to Categories
            const arg_emojis: Categories[] = [];
            // if (args.length > 0) {
                for (let i = 0; i < args[0].split(",").length; i++) {
                    arg_emojis.push(args[0].split(",")[i] as Categories);
                }
            // }

            //cast string emojis: [ '💩', '🐶' ] to type Categories['💩', '🐶']
            const cast_to_categories = (arr: string[]): Categories[] => {
                if (arr === undefined || arr === null) { return [] }
                return arr.map(item => item as Categories);
            }

            let metadata = {
                args_length: args?.length,
                categories: args[0] != "null" ? arg_emojis : cast_to_categories(metadata_original["emojis"]),
                type: args[1] != "null" ? getStickerType(args[1]) : StickerTypes.FULL,
                // pack_name: args[2] ?? metadata_original['sticker-pack-name'],
                pack_name: (args[2] == "null" || args[2]?.length == 0) ? metadata_original['sticker-pack-name'] : args[2],
                // author_name: args[3] ?? metadata_original['sticker-pack-publisher'],
                author_name: (args[3] == "null" || args[3]?.length == 0) ? metadata_original['sticker-pack-publisher'] : args[3],
                id: metadata_original['sticker-id'],
                // quality: 100, // The quality of the output file
                // background: '#000000' // The sticker background color (only for full stickers)
                // android_app_store_link: metadata_original['android-app-store-link'],
            }
            
            const sticker = new Sticker(filePath, {
                categories: metadata.categories,
                type: metadata.type,
                pack: metadata.pack_name,
                author: metadata.author_name,
                id: metadata.id,
            })

            await sticker.toFile(fileWebp)
            await client.sendMessage(
                BotsApp.chatId,
                fs.readFileSync(fileWebp),
                MessageType.sticker,
            ).catch(err => inputSanitization.handleError(err, client, BotsApp));
            await inputSanitization.deleteFiles(filePath, fileWebp);
        } else {
            await client.sendMessage(
                BotsApp.chatId,
                smeta.NO_REPLY,
                MessageType.text
            ).catch(err => inputSanitization.handleError(err, client, BotsApp));
        }
        return
    }

};