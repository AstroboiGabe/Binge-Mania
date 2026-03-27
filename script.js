document.addEventListener('DOMContentLoaded', () => {
    const amazeBtn = document.getElementById('amazeBtn');
    const resultContainer = document.getElementById('resultContainer');
    const resultTitle = document.getElementById('resultTitle');
    const resultPoster = document.getElementById('resultPoster');
    const posterLoader = document.getElementById('posterLoader');
    const resultDesc = document.getElementById('resultDesc');
    const errorMsg = document.getElementById('errorMessage');
    
    // UI states
    const btnText = document.querySelector('.btn-text');
    const btnLoader = document.querySelector('.btn-loader');

    amazeBtn.addEventListener('click', async () => {
        // Collect Inputs
        const apiKey = document.getElementById('apiKey').value.trim();
        const type = document.getElementById('type').value;
        const language = document.getElementById('language').value;
        const year = document.getElementById('year').value;
        const rating = document.getElementById('rating').value;
        const genre = document.getElementById('genre').value;
        const director = document.getElementById('director').value;

        if (!apiKey) {
            showError("Please enter your Gemini API Key at the top.");
            return;
        }

        hideError();
        setLoading(true);

        // Array of random moods/styles to force the AI into diving deep into different parts of its knowledge base every time
        const categories = [
            "an underrated hidden gem", 
            "a massive blockbuster hit", 
            "a critically acclaimed masterpiece", 
            "a visually stunning cinematic marvel", 
            "an emotionally gripping and intense story", 
            "a lesser-known but historically brilliant work", 
            "a culturally significant cult classic", 
            "a fast-paced, edge-of-your-seat thriller", 
            "a thought-provoking and philosophical narrative"
        ];
        const randomVibe = categories[Math.floor(Math.random() * categories.length)];

        const prompt = `You are a TV and Movie recommendation expert. 
Based on these exact parameters:
- Type: ${type}
- Language: ${language}
- Year: ${year}
- IMDB Rating: ${rating}
- Genre: ${genre}
- Director: ${director}

Recommend exactly ONE distinct ${type === 'Any' ? 'movie or tv show' : type} that closely matches these parameters. 
CRITICAL VARIETY INSTRUCTION: To ensure a diverse and exciting experience, focus specifically on finding: ${randomVibe}. 
Do NOT automatically recommend the most obvious, famous choice if another excellent match exists. Dive extremely deep into your cinematic knowledge base.

You MUST reply strictly in this JSON format, and do NOT wrap it in markdown block quotes. Just the raw JSON object.
{
  "title": "Exact Title of the media",
  "description": "A compelling, exciting 2-3 sentence synopsis/description.",
  "posterPrompt": "A highly detailed image generation prompt for a movie poster of this media, including title typography, main characters, cinematic lighting."
}`;

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const reqBody = {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.95
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqBody)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || "Failed to fetch from Gemini API");
            }

            const data = await response.json();
            const textResponse = data.candidates[0].content.parts[0].text;
            
            // Clean up potentially returning markdown blocks
            let jsonString = textResponse.trim();
            if (jsonString.startsWith('```json')) {
                jsonString = jsonString.substring(7);
            }
            if (jsonString.startsWith('```')) {
                jsonString = jsonString.substring(3);
            }
            if (jsonString.endsWith('```')) {
                jsonString = jsonString.substring(0, jsonString.length - 3);
            }
            jsonString = jsonString.trim();

            const parsedData = JSON.parse(jsonString);

            displayResult(parsedData, type);
        } catch (error) {
            console.error('API Error:', error);
            showError("Error generating recommendation: " + error.message);
            setLoading(false);
        }
    });

    function displayResult(data, selectedType) {
        // Hide result initially if showing
        resultContainer.classList.add('hidden');
        
        // Ensure properties exist
        const title = data.title || "Unknown Title";
        const desc = data.description || "No description available.";
        // Fallback prompt if API didn't give one
        const posterPromptText = data.posterPrompt || `Official movie poster for ${title}, cinematic lighting, masterpiece`;

        // Update Text
        resultTitle.textContent = title;
        resultDesc.textContent = desc;
        
        // Render Image
        resultPoster.style.display = 'none';
        posterLoader.classList.remove('hidden');
        
        resultPoster.onload = () => {
            posterLoader.classList.add('hidden');
            resultPoster.style.display = 'block';
            resultPoster.style.animation = 'fadeUp 0.5s ease forwards';
        };
        
        resultPoster.onerror = () => {
            posterLoader.classList.add('hidden');
            resultPoster.style.display = 'block';
            resultPoster.alt = "Failed to load poster";
        };

        const fetchPoster = async () => {
            const fallbackSrc = `https://placehold.co/400x600/181a20/ff2a40/png?text=${encodeURIComponent(title)}`;
            
            try {
                // Absolute Bulletproof Method: OMDB API + TVMaze Fallback
                // OMDB natively supports CORS (*), handles complex movie names ("The Shawshank Redemption"), 
                // and avoids all script blockers/proxies that caused the previous 0-result failures.
                const omdbUrl = `https://www.omdbapi.com/?apikey=thewdb&t=${encodeURIComponent(title)}`;
                
                let res = await fetch(omdbUrl);
                let data = await res.json();
                
                if (data.Response === "True" && data.Poster && data.Poster !== "N/A") {
                    // OMDB returns a 300px width IMDB thumbnail. Upgrade it to 700px High-Res!
                    resultPoster.src = data.Poster.replace('SX300.jpg', 'SX700.jpg');
                    return;
                }
                
                // Native fallback to TVMaze (Excellent for TV Shows like Breaking Bad)
                res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`);
                data = await res.json();
                
                if (data && data.length > 0 && data[0].show && data[0].show.image && data[0].show.image.original) {
                    resultPoster.src = data[0].show.image.original;
                    return;
                }

                resultPoster.src = fallbackSrc;
            } catch (err) {
                console.error("Fetch Error:", err);
                resultPoster.src = fallbackSrc;
            }
        };

        fetchPoster();

        // Reveal container
        resultContainer.classList.remove('hidden');
        setLoading(false);
    }

    function setLoading(isLoading) {
        if (isLoading) {
            amazeBtn.disabled = true;
            btnText.style.display = 'none';
            btnLoader.style.display = 'inline';
            resultContainer.classList.add('hidden');
        } else {
            amazeBtn.disabled = false;
            btnText.style.display = 'inline';
            btnLoader.style.display = 'none';
        }
    }

    function showError(msg) {
        errorMsg.textContent = msg;
        errorMsg.classList.remove('hidden');
    }

    function hideError() {
        errorMsg.classList.add('hidden');
        errorMsg.textContent = "";
    }
});
