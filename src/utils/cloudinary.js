import { v2 as cloudinary } from 'cloudinary';
import fs from "fs"


cloudinary.config(
    {
        cloud_name: process.env.CLOUDINARY_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    }
);


export const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath){
            throw new Error("File path is required to upload on Cloudinary")
        }
    
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })

        fs.unlinkSync(localFilePath)
        
        return response;

    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved file as the uplaod operation got failed
        return null;
    }
}


export const deleteOnCloudinary = async (public_id) => {
    if (!public_id) {
        throw new Error("Public ID is required to delete an asset");
    }
    try {
        const resource = await cloudinary.api.resource(public_id);

        if (!resource || !resource.resource_type) {
            console.warn(`Cannot determine resource type for public_id: ${public_id}`);
            return { result: "not_found" };
        }

        const result = await cloudinary.uploader.destroy(public_id, {
            resource_type: resource.resource_type
        });

        if (result.result !== "ok") {
            throw new Error(`Failed to delete asset: ${result.result}`);
        }

        return result;
    } catch (error) {
        console.error("Error deleting asset on Cloudinary:", error.message);
        throw error;
    }
};


export const getPublicIdFromURL = (url) => {
    if(!url){
        return null;
    }
    const parts = url.split("/");
    const filename = parts[parts.length -1];
    const publicId = filename.substr(0, filename.lastIndexOf("."));
    return publicId;
}


