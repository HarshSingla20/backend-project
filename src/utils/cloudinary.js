import { v2 as cloudinary } from 'cloudinary';
import fs from "fs"


cloudinary.config(
    {
        cloud_name: process.env.CLOUDINARY_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    }
);


const uploadOnCloudinary = async (localFilePath) => {
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

export { uploadOnCloudinary };