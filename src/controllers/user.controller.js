import User from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"

export const registerUser = async (req, res) => {
    try {
        const { username, fullName, email, password } = req.body;
        
        if([fullName, username, email, password].some((field) => field?.trim === "")){
            return res.status(400).json({message: "All fields are required"})
        }

        const existedUser = await User.findOne({
            $or: [{ username }, { email }]
        })
        
        if(existedUser){
            return res.status(409).json({message: "User email or username already exists"});
        }

        const avatarLocalPath = req.files?.avatar[0]?.path

        let coverImageLocalPath;
        if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
            coverImageLocalPath = req.files.coverImage[0].path
        }

        if(!avatarLocalPath){
            return res.status(400).json({message: "Avatar is required"});
        }

        const avatar = await uploadOnCloudinary(avatarLocalPath)
        const coverImage = await uploadOnCloudinary(coverImageLocalPath)

        if(!avatar){
            return res.status(400).json({message: "Avatar is required"});
        }

        const user = await User.create({
            username: username.toLowerCase(),
            fullName,
            avatar: avatar.url,
            password,
            email,
            coverImage: coverImage?.url || "",

        })

        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken"
        );
        if(!createdUser){
            return res.status(500).json({message: "Failed to register user"});
        }

        return res.status(201).json(
            {
                message: "User register Successfully",
                createdUser
            }
        )

    } catch (error) {
        return res.status(500).json({message: error.message});
    }
}